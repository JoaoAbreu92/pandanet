BEGIN;

CREATE OR REPLACE FUNCTION public.stage32_prepare_job_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_company_id uuid;
BEGIN
  IF NEW.employee_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'A candidatura somente pode ser criada pelo próprio colaborador.';
  END IF;

  SELECT company_id INTO target_company_id
  FROM public.jobs
  WHERE id = NEW.job_id
    AND status = 'open';

  IF target_company_id IS NULL THEN
    RAISE EXCEPTION 'Vaga inexistente ou encerrada.';
  END IF;

  IF NOT public.stage32_is_company_member(target_company_id) THEN
    RAISE EXCEPTION 'A vaga não pertence à empresa do colaborador.';
  END IF;

  NEW.company_id := target_company_id;
  NEW.status := 'pending';
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS stage32_prepare_job_application_trigger
ON public.job_applications;

CREATE TRIGGER stage32_prepare_job_application_trigger
BEFORE INSERT ON public.job_applications
FOR EACH ROW
EXECUTE FUNCTION public.stage32_prepare_job_application();

REVOKE ALL ON FUNCTION public.stage32_prepare_job_application() FROM PUBLIC;

COMMIT;
