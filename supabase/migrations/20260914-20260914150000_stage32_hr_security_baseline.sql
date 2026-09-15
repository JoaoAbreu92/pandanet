BEGIN;

CREATE OR REPLACE FUNCTION public.stage32_is_company_member(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND company_id = target_company_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.stage32_can_manage_company(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_platform_admin()
      OR public.is_company_admin_v2(target_company_id);
$function$;

DO $block$
DECLARE
  target_table text;
  existing_policy record;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'departments', 'department_users', 'jobs', 'job_applications',
    'hr_documents', 'hr_employee_benefits', 'hr_evaluations',
    'hr_payslips', 'hr_time_bank', 'hr_vacation_balance',
    'hr_vacation_requests'
  ]
  LOOP
    FOR existing_policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = target_table
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', existing_policy.policyname, target_table);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', target_table);
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated',
      target_table
    );
  END LOOP;
END
$block$;

CREATE POLICY departments_select_company ON public.departments
FOR SELECT TO authenticated
USING (stage32_is_company_member(company_id) OR is_platform_admin());

CREATE POLICY departments_insert_admin ON public.departments
FOR INSERT TO authenticated
WITH CHECK (stage32_can_manage_company(company_id));

CREATE POLICY departments_update_admin ON public.departments
FOR UPDATE TO authenticated
USING (stage32_can_manage_company(company_id))
WITH CHECK (stage32_can_manage_company(company_id));

CREATE POLICY departments_delete_admin ON public.departments
FOR DELETE TO authenticated
USING (stage32_can_manage_company(company_id));

CREATE POLICY department_users_select_company ON public.department_users
FOR SELECT TO authenticated
USING (stage32_is_company_member(company_id) OR is_platform_admin());

CREATE POLICY department_users_insert_admin ON public.department_users
FOR INSERT TO authenticated
WITH CHECK (
  stage32_can_manage_company(company_id)
  AND EXISTS (SELECT 1 FROM public.departments d WHERE d.id = department_id AND d.company_id = department_users.company_id)
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.company_id = department_users.company_id)
);

CREATE POLICY department_users_update_admin ON public.department_users
FOR UPDATE TO authenticated
USING (stage32_can_manage_company(company_id))
WITH CHECK (
  stage32_can_manage_company(company_id)
  AND EXISTS (SELECT 1 FROM public.departments d WHERE d.id = department_id AND d.company_id = department_users.company_id)
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.company_id = department_users.company_id)
);

CREATE POLICY department_users_delete_admin ON public.department_users
FOR DELETE TO authenticated
USING (stage32_can_manage_company(company_id));

CREATE POLICY jobs_select_company ON public.jobs
FOR SELECT TO authenticated
USING (stage32_is_company_member(company_id) OR is_platform_admin());

CREATE POLICY jobs_insert_admin ON public.jobs
FOR INSERT TO authenticated
WITH CHECK (company_id IS NOT NULL AND stage32_can_manage_company(company_id));

CREATE POLICY jobs_update_admin ON public.jobs
FOR UPDATE TO authenticated
USING (stage32_can_manage_company(company_id))
WITH CHECK (company_id IS NOT NULL AND stage32_can_manage_company(company_id));

CREATE POLICY jobs_delete_admin ON public.jobs
FOR DELETE TO authenticated
USING (stage32_can_manage_company(company_id));

CREATE UNIQUE INDEX IF NOT EXISTS job_applications_job_employee_uidx
ON public.job_applications (job_id, employee_id);

CREATE POLICY job_applications_select_scoped ON public.job_applications
FOR SELECT TO authenticated
USING (employee_id = auth.uid() OR stage32_can_manage_company(company_id));

CREATE POLICY job_applications_insert_self ON public.job_applications
FOR INSERT TO authenticated
WITH CHECK (
  employee_id = auth.uid()
  AND stage32_is_company_member(company_id)
  AND EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_id AND j.company_id = job_applications.company_id AND j.status = 'open'
  )
);

CREATE POLICY job_applications_update_admin ON public.job_applications
FOR UPDATE TO authenticated
USING (stage32_can_manage_company(company_id))
WITH CHECK (stage32_can_manage_company(company_id));

CREATE POLICY job_applications_delete_scoped ON public.job_applications
FOR DELETE TO authenticated
USING (
  stage32_can_manage_company(company_id)
  OR (employee_id = auth.uid() AND status = 'pending')
);

CREATE POLICY hr_documents_select_scoped ON public.hr_documents
FOR SELECT TO authenticated
USING (
  stage32_can_manage_company(company_id)
  OR (
    stage32_is_company_member(company_id)
    AND (
      COALESCE(target_type, 'all') = 'all'
      OR (target_type = 'users' AND auth.uid() = ANY(COALESCE(target_users, '{}'::uuid[])))
      OR (target_type = 'departments' AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.department_id = ANY(COALESCE(hr_documents.target_departments, '{}'::uuid[]))
      ))
      OR created_by = auth.uid()
    )
  )
);

CREATE POLICY hr_documents_insert_admin ON public.hr_documents
FOR INSERT TO authenticated
WITH CHECK (stage32_can_manage_company(company_id) AND created_by = auth.uid());

CREATE POLICY hr_documents_update_admin ON public.hr_documents
FOR UPDATE TO authenticated
USING (stage32_can_manage_company(company_id))
WITH CHECK (stage32_can_manage_company(company_id));

CREATE POLICY hr_documents_delete_admin ON public.hr_documents
FOR DELETE TO authenticated
USING (stage32_can_manage_company(company_id));

CREATE POLICY hr_payslips_select_scoped ON public.hr_payslips
FOR SELECT TO authenticated
USING (employee_id = auth.uid() OR stage32_can_manage_company(company_id));

CREATE POLICY hr_payslips_write_admin ON public.hr_payslips
FOR ALL TO authenticated
USING (stage32_can_manage_company(company_id))
WITH CHECK (stage32_can_manage_company(company_id));

CREATE POLICY hr_employee_benefits_select_scoped ON public.hr_employee_benefits
FOR SELECT TO authenticated
USING (employee_id = auth.uid() OR stage32_can_manage_company(company_id));

CREATE POLICY hr_employee_benefits_write_admin ON public.hr_employee_benefits
FOR ALL TO authenticated
USING (stage32_can_manage_company(company_id))
WITH CHECK (company_id IS NOT NULL AND stage32_can_manage_company(company_id));

CREATE POLICY hr_evaluations_select_scoped ON public.hr_evaluations
FOR SELECT TO authenticated
USING (employee_id = auth.uid() OR stage32_can_manage_company(company_id));

CREATE POLICY hr_evaluations_write_admin ON public.hr_evaluations
FOR ALL TO authenticated
USING (stage32_can_manage_company(company_id))
WITH CHECK (company_id IS NOT NULL AND stage32_can_manage_company(company_id));

CREATE POLICY hr_time_bank_select_scoped ON public.hr_time_bank
FOR SELECT TO authenticated
USING (employee_id = auth.uid() OR stage32_can_manage_company(company_id));

CREATE POLICY hr_time_bank_write_admin ON public.hr_time_bank
FOR ALL TO authenticated
USING (stage32_can_manage_company(company_id))
WITH CHECK (company_id IS NOT NULL AND stage32_can_manage_company(company_id));

CREATE POLICY hr_vacation_balance_select_scoped ON public.hr_vacation_balance
FOR SELECT TO authenticated
USING (employee_id = auth.uid() OR stage32_can_manage_company(company_id));

CREATE POLICY hr_vacation_balance_write_admin ON public.hr_vacation_balance
FOR ALL TO authenticated
USING (stage32_can_manage_company(company_id))
WITH CHECK (stage32_can_manage_company(company_id));

CREATE POLICY hr_vacation_requests_select_scoped ON public.hr_vacation_requests
FOR SELECT TO authenticated
USING (employee_id = auth.uid() OR stage32_can_manage_company(company_id));

CREATE POLICY hr_vacation_requests_insert_self ON public.hr_vacation_requests
FOR INSERT TO authenticated
WITH CHECK (employee_id = auth.uid() AND stage32_is_company_member(company_id));

CREATE POLICY hr_vacation_requests_update_admin ON public.hr_vacation_requests
FOR UPDATE TO authenticated
USING (stage32_can_manage_company(company_id))
WITH CHECK (stage32_can_manage_company(company_id));

CREATE POLICY hr_vacation_requests_delete_scoped ON public.hr_vacation_requests
FOR DELETE TO authenticated
USING (
  stage32_can_manage_company(company_id)
  OR (employee_id = auth.uid() AND status = 'pending')
);

CREATE INDEX IF NOT EXISTS departments_company_name_idx
ON public.departments (company_id, lower(name));

CREATE INDEX IF NOT EXISTS jobs_company_status_created_idx
ON public.jobs (company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS hr_documents_company_created_idx
ON public.hr_documents (company_id, created_at DESC);

COMMIT;
