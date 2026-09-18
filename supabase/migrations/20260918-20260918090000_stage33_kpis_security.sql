BEGIN;
ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kpis FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.kpis FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpis TO authenticated;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.kpis;
DROP POLICY IF EXISTS stage33_kpis_select ON public.kpis;
DROP POLICY IF EXISTS stage33_kpis_insert ON public.kpis;
DROP POLICY IF EXISTS stage33_kpis_update ON public.kpis;
DROP POLICY IF EXISTS stage33_kpis_delete ON public.kpis;
CREATE POLICY stage33_kpis_select ON public.kpis FOR SELECT TO authenticated
USING (public.stage32_is_company_member(company_id) OR public.is_platform_admin());
CREATE POLICY stage33_kpis_insert ON public.kpis FOR INSERT TO authenticated
WITH CHECK (public.stage32_can_manage_company(company_id));
CREATE POLICY stage33_kpis_update ON public.kpis FOR UPDATE TO authenticated
USING (public.stage32_can_manage_company(company_id)) WITH CHECK (public.stage32_can_manage_company(company_id));
CREATE POLICY stage33_kpis_delete ON public.kpis FOR DELETE TO authenticated
USING (public.stage32_can_manage_company(company_id));
CREATE INDEX IF NOT EXISTS stage33_kpis_company_category_idx ON public.kpis (company_id, category, name);
COMMIT;
