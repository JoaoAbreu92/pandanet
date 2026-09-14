BEGIN;

CREATE OR REPLACE FUNCTION public.is_company_admin_v2(company_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND company_id = company_uuid
      AND (
        COALESCE(is_admin, false)
        OR COALESCE(is_company_admin, false)
        OR lower(btrim(COALESCE(role, ''))) IN (
          'admin',
          'company admin',
          'administrador',
          'administrador da empresa'
        )
      )
  );
$function$;

DROP POLICY IF EXISTS storage_documents_insert_scoped ON storage.objects;
DROP POLICY IF EXISTS storage_documents_update_scoped ON storage.objects;
DROP POLICY IF EXISTS storage_documents_delete_scoped ON storage.objects;

CREATE POLICY storage_documents_insert_scoped
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND split_part(name, '/', 2) = auth.uid()::text
  AND (
    is_platform_admin()
    OR (
      split_part(name, '/', 1) = get_user_company_id()::text
      AND is_company_admin_v2(get_user_company_id())
    )
  )
);

CREATE POLICY storage_documents_update_scoped
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    is_platform_admin()
    OR (
      split_part(name, '/', 1) = get_user_company_id()::text
      AND is_company_admin_v2(get_user_company_id())
    )
  )
)
WITH CHECK (
  bucket_id = 'documents'
  AND (
    is_platform_admin()
    OR (
      split_part(name, '/', 1) = get_user_company_id()::text
      AND is_company_admin_v2(get_user_company_id())
    )
  )
);

CREATE POLICY storage_documents_delete_scoped
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    is_platform_admin()
    OR (
      split_part(name, '/', 1) = get_user_company_id()::text
      AND is_company_admin_v2(get_user_company_id())
    )
  )
);

COMMIT;
