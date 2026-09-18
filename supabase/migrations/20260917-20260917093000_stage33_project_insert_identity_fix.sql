BEGIN;

ALTER TABLE public.projects
  ALTER COLUMN created_by SET DEFAULT auth.uid();

CREATE OR REPLACE FUNCTION public.stage33_prepare_project_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  actor_company_id uuid;
BEGIN
  actor_company_id := public.get_user_company_id();

  IF auth.uid() IS NULL OR actor_company_id IS NULL THEN
    RAISE EXCEPTION 'Sessão autenticada e empresa válida são obrigatórias';
  END IF;

  NEW.created_by := auth.uid();
  NEW.company_id := actor_company_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.stage33_prepare_project_identity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS stage33_prepare_project_identity_trigger ON public.projects;
CREATE TRIGGER stage33_prepare_project_identity_trigger
BEFORE INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.stage33_prepare_project_identity();

COMMIT;
