BEGIN;

REVOKE ALL ON TABLE public.marketplace_items FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.marketplace_items TO authenticated;

ALTER TABLE public.marketplace_items ENABLE ROW LEVEL SECURITY;

DO $policy_cleanup$
DECLARE policy_record record;
BEGIN
  FOR policy_record IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'marketplace_items'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.marketplace_items', policy_record.policyname);
  END LOOP;
END
$policy_cleanup$;

CREATE OR REPLACE FUNCTION public.marketplace_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (lower(coalesce(p.role, '')) = 'super admin' OR coalesce(p.is_admin, false))
  );
$$;

CREATE OR REPLACE FUNCTION public.marketplace_can_manage(target_company uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        (lower(coalesce(p.role, '')) = 'super admin' OR coalesce(p.is_admin, false))
        OR (
          p.company_id = target_company
          AND (
            coalesce(p.is_company_admin, false)
            OR coalesce((p.permissions ->> 'manageMarketplace')::boolean, false)
          )
        )
      )
  );
$$;

CREATE POLICY marketplace_select_company
ON public.marketplace_items FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id() OR public.marketplace_is_platform_admin());

CREATE POLICY marketplace_insert_authorized
ON public.marketplace_items FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id()
  AND listed_by = auth.uid()
  AND public.marketplace_can_manage(company_id)
);

CREATE POLICY marketplace_update_owner_or_manager
ON public.marketplace_items FOR UPDATE TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (listed_by = auth.uid() OR public.marketplace_can_manage(company_id))
  OR public.marketplace_is_platform_admin()
)
WITH CHECK (
  company_id = public.get_user_company_id()
  AND (listed_by = auth.uid() OR public.marketplace_can_manage(company_id))
  OR public.marketplace_is_platform_admin()
);

CREATE POLICY marketplace_delete_owner_or_manager
ON public.marketplace_items FOR DELETE TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (listed_by = auth.uid() OR public.marketplace_can_manage(company_id))
  OR public.marketplace_is_platform_admin()
);

CREATE OR REPLACE FUNCTION public.marketplace_reserve_item(p_item_id uuid)
RETURNS public.marketplace_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE item public.marketplace_items;
DECLARE caller_company uuid;
BEGIN
  caller_company := public.get_user_company_id();
  IF auth.uid() IS NULL OR caller_company IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado.'; END IF;

  SELECT * INTO item FROM public.marketplace_items
  WHERE id = p_item_id AND company_id = caller_company
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Anúncio não localizado.'; END IF;

  IF item.status = 'Reservado' AND item.reserved_at < now() - interval '24 hours' THEN
    item.status := 'Disponível'; item.reserved_by := NULL; item.reserved_at := NULL;
  END IF;
  IF item.status <> 'Disponível' THEN RAISE EXCEPTION 'Este item não está mais disponível.'; END IF;

  UPDATE public.marketplace_items
  SET status = 'Reservado', reserved_by = auth.uid(), reserved_at = now(), updated_at = now()
  WHERE id = p_item_id RETURNING * INTO item;
  RETURN item;
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_cancel_reservation(p_item_id uuid)
RETURNS public.marketplace_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE item public.marketplace_items;
BEGIN
  SELECT * INTO item FROM public.marketplace_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Anúncio não localizado.'; END IF;
  IF NOT public.marketplace_is_platform_admin()
     AND item.company_id <> public.get_user_company_id() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF auth.uid() <> item.reserved_by AND auth.uid() <> item.listed_by
     AND NOT public.marketplace_can_manage(item.company_id) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  UPDATE public.marketplace_items
  SET status = 'Disponível', reserved_by = NULL, reserved_at = NULL, updated_at = now()
  WHERE id = p_item_id RETURNING * INTO item;
  RETURN item;
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_release_expired_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE affected integer;
BEGIN
  UPDATE public.marketplace_items
  SET status = 'Disponível', reserved_by = NULL, reserved_at = NULL, updated_at = now()
  WHERE company_id = public.get_user_company_id()
    AND status = 'Reservado'
    AND reserved_at < now() - interval '24 hours';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.marketplace_reserve_item(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marketplace_cancel_reservation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marketplace_release_expired_reservations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketplace_reserve_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_cancel_reservation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_release_expired_reservations() TO authenticated;

UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']::text[]
WHERE id = 'marketplace-media';

DROP POLICY IF EXISTS "storage_marketplace_media_upload_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update marketplace media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete marketplace media" ON storage.objects;

CREATE POLICY storage_marketplace_insert_scoped
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'marketplace-media'
  AND split_part(name, '/', 1) = public.get_user_company_id()::text
  AND split_part(name, '/', 2) = auth.uid()::text
);

CREATE POLICY storage_marketplace_update_owner
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'marketplace-media' AND owner_id = auth.uid()::text)
WITH CHECK (bucket_id = 'marketplace-media' AND owner_id = auth.uid()::text);

CREATE POLICY storage_marketplace_delete_owner
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'marketplace-media'
  AND (owner_id = auth.uid()::text OR public.marketplace_can_manage((split_part(name, '/', 1))::uuid))
);

CREATE INDEX IF NOT EXISTS marketplace_items_company_created_idx
ON public.marketplace_items(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS marketplace_items_reservation_idx
ON public.marketplace_items(company_id, status, reserved_at);

COMMIT;
