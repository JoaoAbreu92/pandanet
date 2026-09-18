BEGIN;

CREATE OR REPLACE FUNCTION public.stage33_can_view_project(target_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects project
    WHERE project.id = target_project_id
      AND project.company_id = public.get_user_company_id()
      AND (
        project.created_by = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.project_members member
          WHERE member.project_id = project.id
            AND member.user_id = auth.uid()
        )
        OR NOT EXISTS (
          SELECT 1
          FROM public.project_departments access_department
          WHERE access_department.project_id = project.id
        )
        OR EXISTS (
          SELECT 1
          FROM public.project_departments access_department
          JOIN public.profiles profile
            ON profile.id = auth.uid()
           AND profile.company_id = project.company_id
           AND profile.department_id = access_department.department_id
          WHERE access_department.project_id = project.id
        )
        OR EXISTS (
          SELECT 1
          FROM public.project_departments access_department
          JOIN public.department_users department_user
            ON department_user.department_id = access_department.department_id
           AND department_user.user_id = auth.uid()
           AND department_user.company_id = project.company_id
          WHERE access_department.project_id = project.id
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.stage33_can_view_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stage33_can_view_project(uuid) TO authenticated;

COMMIT;
