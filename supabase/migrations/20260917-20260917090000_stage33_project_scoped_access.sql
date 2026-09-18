BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.project_departments (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  added_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, department_id)
);

CREATE TABLE IF NOT EXISTS public.project_members (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  can_edit boolean NOT NULL DEFAULT false,
  added_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

UPDATE public.projects project
SET created_by = COALESCE(
  project.manager_id,
  (
    SELECT profile.id
    FROM public.profiles profile
    WHERE profile.company_id = project.company_id
      AND (
        profile.is_admin = true
        OR profile.is_company_admin = true
        OR profile.role IN ('admin', 'Super Admin')
      )
    ORDER BY profile.id
    LIMIT 1
  )
)
WHERE project.created_by IS NULL;

INSERT INTO public.project_departments (project_id, department_id, added_by)
SELECT DISTINCT stage.project_id, stage.department_id, project.created_by
FROM public.project_stages stage
JOIN public.projects project ON project.id = stage.project_id
JOIN public.departments department
  ON department.id = stage.department_id
 AND department.company_id = project.company_id
WHERE stage.department_id IS NOT NULL
ON CONFLICT (project_id, department_id) DO NOTHING;

INSERT INTO public.project_members (project_id, user_id, can_edit, added_by)
SELECT project.id, profile.id, true, project.created_by
FROM public.projects project
JOIN public.profiles profile ON profile.company_id = project.company_id
WHERE profile.id = project.manager_id
   OR profile.id = project.created_by
   OR profile.is_admin = true
   OR profile.is_company_admin = true
   OR profile.role IN ('admin', 'Super Admin')
ON CONFLICT (project_id, user_id)
DO UPDATE SET can_edit = true;

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
          SELECT 1 FROM public.project_members member
          WHERE member.project_id = project.id
            AND member.user_id = auth.uid()
        )
        OR NOT EXISTS (
          SELECT 1 FROM public.project_departments access_department
          WHERE access_department.project_id = project.id
        )
        OR EXISTS (
          SELECT 1
          FROM public.project_departments access_department
          JOIN public.department_users department_user
            ON department_user.department_id = access_department.department_id
          WHERE access_department.project_id = project.id
            AND department_user.user_id = auth.uid()
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.stage33_can_edit_project(target_project_id uuid)
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
          SELECT 1 FROM public.project_members member
          WHERE member.project_id = project.id
            AND member.user_id = auth.uid()
            AND member.can_edit = true
        )
      )
  );
$$;

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
    SELECT 1 FROM unnest(COALESCE(target_department_ids, '{}'::uuid[])) department_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.departments department
      WHERE department.id = department_id
        AND department.company_id = target_company_id
    )
  ) THEN
    RAISE EXCEPTION 'Um ou mais setores não pertencem à empresa do projeto';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(target_editor_ids, '{}'::uuid[])) user_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.profiles profile
      WHERE profile.id = user_id
        AND profile.company_id = target_company_id
    )
  ) THEN
    RAISE EXCEPTION 'Um ou mais colaboradores não pertencem à empresa do projeto';
  END IF;

  DELETE FROM public.project_departments WHERE project_id = target_project_id;
  INSERT INTO public.project_departments (project_id, department_id, added_by)
  SELECT target_project_id, department_id, auth.uid()
  FROM unnest(COALESCE(target_department_ids, '{}'::uuid[])) department_id
  ON CONFLICT DO NOTHING;

  DELETE FROM public.project_members
  WHERE project_id = target_project_id
    AND user_id <> auth.uid();

  INSERT INTO public.project_members (project_id, user_id, can_edit, added_by)
  SELECT target_project_id, user_id, true, auth.uid()
  FROM unnest(array_append(COALESCE(target_editor_ids, '{}'::uuid[]), auth.uid())) user_id
  ON CONFLICT (project_id, user_id)
  DO UPDATE SET can_edit = true, added_by = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.stage33_can_view_project(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.stage33_can_edit_project(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.stage33_set_project_access(uuid, uuid[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stage33_can_view_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stage33_can_edit_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stage33_set_project_access(uuid, uuid[], uuid[]) TO authenticated;

ALTER TABLE public.project_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.projects, public.project_stages, public.project_tasks,
  public.project_subtasks, public.project_task_comments, public.project_task_history,
  public.project_timesheets, public.project_departments, public.project_members FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects, public.project_stages,
  public.project_tasks, public.project_subtasks, public.project_task_comments,
  public.project_task_history, public.project_timesheets, public.project_departments,
  public.project_members TO authenticated;

DROP POLICY IF EXISTS "Projects access policy" ON public.projects;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.projects;
CREATE POLICY stage33_projects_select ON public.projects FOR SELECT TO authenticated
  USING (public.stage33_can_view_project(id));
CREATE POLICY stage33_projects_insert ON public.projects FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id() AND created_by = auth.uid());
CREATE POLICY stage33_projects_update ON public.projects FOR UPDATE TO authenticated
  USING (public.stage33_can_edit_project(id))
  WITH CHECK (company_id = public.get_user_company_id() AND public.stage33_can_edit_project(id));
CREATE POLICY stage33_projects_delete ON public.projects FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND company_id = public.get_user_company_id());

CREATE POLICY stage33_project_departments_select ON public.project_departments FOR SELECT TO authenticated
  USING (public.stage33_can_view_project(project_id));
CREATE POLICY stage33_project_departments_manage ON public.project_departments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects project WHERE project.id = project_departments.project_id AND project.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects project WHERE project.id = project_departments.project_id AND project.created_by = auth.uid()));

CREATE POLICY stage33_project_members_select ON public.project_members FOR SELECT TO authenticated
  USING (public.stage33_can_view_project(project_id));
CREATE POLICY stage33_project_members_manage ON public.project_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects project WHERE project.id = project_members.project_id AND project.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects project WHERE project.id = project_members.project_id AND project.created_by = auth.uid()));

DROP POLICY IF EXISTS "Stages access policy" ON public.project_stages;
CREATE POLICY stage33_project_stages_select ON public.project_stages FOR SELECT TO authenticated
  USING (public.stage33_can_view_project(project_id));
CREATE POLICY stage33_project_stages_manage ON public.project_stages FOR ALL TO authenticated
  USING (public.stage33_can_edit_project(project_id))
  WITH CHECK (public.stage33_can_edit_project(project_id));

DROP POLICY IF EXISTS "Tasks access policy" ON public.project_tasks;
CREATE POLICY stage33_project_tasks_select ON public.project_tasks FOR SELECT TO authenticated
  USING (public.stage33_can_view_project(project_id));
CREATE POLICY stage33_project_tasks_manage ON public.project_tasks FOR ALL TO authenticated
  USING (public.stage33_can_edit_project(project_id))
  WITH CHECK (public.stage33_can_edit_project(project_id));

DO $$
DECLARE
  target_table text;
  target_policy text;
BEGIN
  FOR target_table, target_policy IN
    SELECT * FROM (VALUES
      ('project_subtasks', 'Subtasks access policy'),
      ('project_task_comments', 'Comments access policy'),
      ('project_task_history', 'Task history access policy'),
      ('project_timesheets', 'Timesheets access policy')
    ) policies(table_name, old_policy)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', target_policy, target_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.project_tasks task WHERE task.id = %I.task_id AND public.stage33_can_view_project(task.project_id)))',
      'stage33_' || target_table || '_select', target_table, target_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.project_tasks task WHERE task.id = %I.task_id AND public.stage33_can_edit_project(task.project_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.project_tasks task WHERE task.id = %I.task_id AND public.stage33_can_edit_project(task.project_id)))',
      'stage33_' || target_table || '_manage', target_table, target_table, target_table
    );
  END LOOP;
END;
$$;

CREATE INDEX IF NOT EXISTS project_departments_department_idx
  ON public.project_departments (department_id, project_id);
CREATE INDEX IF NOT EXISTS project_members_user_idx
  ON public.project_members (user_id, project_id) WHERE can_edit = true;
CREATE INDEX IF NOT EXISTS projects_company_created_idx
  ON public.projects (company_id, created_at DESC);

COMMIT;
