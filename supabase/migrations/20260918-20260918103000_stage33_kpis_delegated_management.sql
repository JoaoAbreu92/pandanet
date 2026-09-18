BEGIN;
CREATE OR REPLACE FUNCTION public.stage33_can_manage_kpis(target_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles profile
    WHERE profile.id = auth.uid()
      AND profile.company_id = target_company_id
      AND (
        profile.is_admin = true OR profile.is_company_admin = true
        OR profile.role IN ('admin', 'Super Admin')
        OR COALESCE((profile.permissions->>'manageKPIs')::boolean, false)
      )
  ) OR public.is_platform_admin();
$$;
REVOKE ALL ON FUNCTION public.stage33_can_manage_kpis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stage33_can_manage_kpis(uuid) TO authenticated;
DROP POLICY IF EXISTS stage33_kpis_insert ON public.kpis;
DROP POLICY IF EXISTS stage33_kpis_update ON public.kpis;
DROP POLICY IF EXISTS stage33_kpis_delete ON public.kpis;
CREATE POLICY stage33_kpis_insert ON public.kpis FOR INSERT TO authenticated WITH CHECK (public.stage33_can_manage_kpis(company_id));
CREATE POLICY stage33_kpis_update ON public.kpis FOR UPDATE TO authenticated USING (public.stage33_can_manage_kpis(company_id)) WITH CHECK (public.stage33_can_manage_kpis(company_id));
CREATE POLICY stage33_kpis_delete ON public.kpis FOR DELETE TO authenticated USING (public.stage33_can_manage_kpis(company_id));
COMMIT;
