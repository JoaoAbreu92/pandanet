BEGIN;

CREATE TABLE IF NOT EXISTS public.dynamic_form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  description text NOT NULL DEFAULT '',
  fields jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(fields) = 'array'),
  audience_type text NOT NULL DEFAULT 'company' CHECK (audience_type IN ('company','departments','users')),
  department_ids uuid[] NOT NULL DEFAULT '{}',
  user_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed')),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dynamic_form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.dynamic_form_templates(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  respondent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(answers) = 'object'),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','reviewed','archived')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS dynamic_form_templates_company_status_idx ON public.dynamic_form_templates(company_id, status);
CREATE INDEX IF NOT EXISTS dynamic_form_responses_template_idx ON public.dynamic_form_responses(template_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS dynamic_form_responses_company_idx ON public.dynamic_form_responses(company_id, submitted_at DESC);

CREATE OR REPLACE FUNCTION public.stage33_can_manage_forms(target_company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.company_id = target_company
      AND (coalesce(p.is_admin,false) OR coalesce(p.is_company_admin,false)
        OR lower(coalesce(p.role,'')) IN ('admin','super admin')
        OR coalesce((p.permissions->>'admin_tab_forms')::boolean,false))
  );
$$;

CREATE OR REPLACE FUNCTION public.stage33_can_view_form(template public.dynamic_form_templates)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT public.stage33_can_manage_forms(template.company_id) OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
      AND p.company_id = template.company_id
      AND coalesce((p.permissions->>'viewForms')::boolean,false)
      AND template.status = 'published'
      AND (template.audience_type = 'company'
        OR (template.audience_type = 'departments' AND p.department_id = ANY(template.department_ids))
        OR (template.audience_type = 'users' AND p.id = ANY(template.user_ids)))
  );
$$;

ALTER TABLE public.dynamic_form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_form_responses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dynamic_form_templates, public.dynamic_form_responses FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dynamic_form_templates, public.dynamic_form_responses TO authenticated;

DROP POLICY IF EXISTS dynamic_forms_select ON public.dynamic_form_templates;
CREATE POLICY dynamic_forms_select ON public.dynamic_form_templates FOR SELECT TO authenticated
USING (public.stage33_can_view_form(dynamic_form_templates));
DROP POLICY IF EXISTS dynamic_forms_manage ON public.dynamic_form_templates;
CREATE POLICY dynamic_forms_manage ON public.dynamic_form_templates FOR ALL TO authenticated
USING (public.stage33_can_manage_forms(company_id)) WITH CHECK (public.stage33_can_manage_forms(company_id));

DROP POLICY IF EXISTS dynamic_form_responses_select ON public.dynamic_form_responses;
CREATE POLICY dynamic_form_responses_select ON public.dynamic_form_responses FOR SELECT TO authenticated
USING (respondent_id = auth.uid() OR public.stage33_can_manage_forms(company_id));
DROP POLICY IF EXISTS dynamic_form_responses_insert ON public.dynamic_form_responses;
CREATE POLICY dynamic_form_responses_insert ON public.dynamic_form_responses FOR INSERT TO authenticated
WITH CHECK (respondent_id = auth.uid() AND company_id = public.get_user_company_id()
  AND EXISTS (SELECT 1 FROM public.dynamic_form_templates f WHERE f.id = template_id AND f.company_id = dynamic_form_responses.company_id AND public.stage33_can_view_form(f)));
DROP POLICY IF EXISTS dynamic_form_responses_manage ON public.dynamic_form_responses;
CREATE POLICY dynamic_form_responses_manage ON public.dynamic_form_responses FOR UPDATE TO authenticated
USING (public.stage33_can_manage_forms(company_id)) WITH CHECK (public.stage33_can_manage_forms(company_id));
DROP POLICY IF EXISTS dynamic_form_responses_delete ON public.dynamic_form_responses;
CREATE POLICY dynamic_form_responses_delete ON public.dynamic_form_responses FOR DELETE TO authenticated
USING (public.stage33_can_manage_forms(company_id));

COMMIT;
