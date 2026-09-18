BEGIN;

CREATE OR REPLACE FUNCTION public.stage33_set_project_access(
  target_project_id uuid,
  target_department_ids uuid[] DEFAULT '{}'::uuid[],
  target_editor_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_company_id uuid;
BEGIN
  SELECT company_id INTO target_company_id
  FROM public.projects
  WHERE id = target_project_id
    AND created_by = auth.uid();

  IF target_company_id IS NULL THEN
    RAISE EXCEPTION 'Apenas o criador pode definir o acesso deste projeto';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(target_department_ids, '{}'::uuid[])) department_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.departments department
      WHERE department.id = department_id
        AND department.company_id = target_company_id
    )
  ) THEN
    RAISE EXCEPTION 'Um ou mais setores não pertencem à empresa do projeto';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(target_editor_ids, '{}'::uuid[])) user_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.profiles profile
      WHERE profile.id = user_id
        AND profile.company_id = target_company_id
    )
  ) THEN
    RAISE EXCEPTION 'Um ou mais colaboradores não pertencem à empresa do projeto';
  END IF;

  DELETE FROM public.project_departments
  WHERE project_id = target_project_id;

  INSERT INTO public.project_departments (project_id, department_id, added_by)
  SELECT target_project_id, source.department_id, auth.uid()
  FROM (
    SELECT DISTINCT department_id
    FROM unnest(COALESCE(target_department_ids, '{}'::uuid[])) department_id
    WHERE department_id IS NOT NULL
  ) source
  ON CONFLICT DO NOTHING;

  DELETE FROM public.project_members
  WHERE project_id = target_project_id
    AND user_id <> auth.uid();

  INSERT INTO public.project_members (project_id, user_id, can_edit, added_by)
  SELECT target_project_id, source.user_id, true, auth.uid()
  FROM (
    SELECT DISTINCT user_id
    FROM unnest(
      array_append(COALESCE(target_editor_ids, '{}'::uuid[]), auth.uid())
    ) user_id
    WHERE user_id IS NOT NULL
  ) source
  ON CONFLICT (project_id, user_id)
  DO UPDATE SET can_edit = EXCLUDED.can_edit, added_by = EXCLUDED.added_by;
END;
$$;

REVOKE ALL ON FUNCTION public.stage33_set_project_access(uuid, uuid[], uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stage33_set_project_access(uuid, uuid[], uuid[])
  TO authenticated;

COMMIT;
