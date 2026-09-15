BEGIN;

DO $block$
DECLARE
  existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'recognitions'
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON public.recognitions',
      existing_policy.policyname
    );
  END LOOP;
END
$block$;

ALTER TABLE public.recognitions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.recognitions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.recognitions TO authenticated;

CREATE POLICY recognitions_select_company ON public.recognitions
FOR SELECT TO authenticated
USING (
  public.stage32_is_company_member(company_id)
  OR public.is_platform_admin()
);

CREATE POLICY recognitions_insert_scoped ON public.recognitions
FOR INSERT TO authenticated
WITH CHECK (
  public.stage32_is_company_member(company_id)
  AND (from_id = auth.uid() OR public.stage32_can_manage_company(company_id))
  AND EXISTS (
    SELECT 1 FROM public.profiles sender
    WHERE sender.id = from_id AND sender.company_id = recognitions.company_id
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles recipient
    WHERE recipient.id = to_id AND recipient.company_id = recognitions.company_id
  )
);

CREATE POLICY recognitions_update_sender_or_admin ON public.recognitions
FOR UPDATE TO authenticated
USING (
  from_id = auth.uid()
  OR public.stage32_can_manage_company(company_id)
)
WITH CHECK (
  public.stage32_is_company_member(company_id)
  AND (from_id = auth.uid() OR public.stage32_can_manage_company(company_id))
  AND EXISTS (
    SELECT 1 FROM public.profiles sender
    WHERE sender.id = from_id AND sender.company_id = recognitions.company_id
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles recipient
    WHERE recipient.id = to_id AND recipient.company_id = recognitions.company_id
  )
);

CREATE POLICY recognitions_delete_sender_or_admin ON public.recognitions
FOR DELETE TO authenticated
USING (
  from_id = auth.uid()
  OR public.stage32_can_manage_company(company_id)
);

CREATE INDEX IF NOT EXISTS recognitions_company_created_idx
ON public.recognitions (company_id, created_at DESC);

COMMIT;
