BEGIN;

CREATE OR REPLACE FUNCTION public.stage32_notify_hr_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  notification_title text;
  notification_description text;
  notification_link text := '/meu-rh';
BEGIN
  IF TG_TABLE_NAME = 'hr_employee_benefits' THEN
    notification_title := 'Novo benefício disponível';
    notification_description := format('O benefício "%s" foi vinculado ao seu perfil.', NEW.name);
  ELSIF TG_TABLE_NAME = 'hr_time_bank' THEN
    notification_title := 'Novo lançamento no banco de horas';
    notification_description := format(
      'Foi registrado um lançamento de %s hora(s) em seu banco de horas.%s',
      NEW.hours_changed,
      CASE WHEN NEW.description IS NULL THEN '' ELSE ' ' || NEW.description END
    );
  ELSIF TG_TABLE_NAME = 'hr_evaluations' THEN
    notification_title := 'Nova avaliação ou meta';
    notification_description := format('O registro "%s" foi disponibilizado para você.', NEW.title);
  ELSIF TG_TABLE_NAME = 'hr_payslips' THEN
    notification_title := 'Novo holerite disponível';
    notification_description := format('Seu holerite de %s está disponível no Portal Meu RH.', NEW.month);
  ELSE
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = NEW.employee_id AND p.company_id = NEW.company_id
  ) THEN
    INSERT INTO public.notifications (
      user_id, company_id, type, title, description, is_read, link
    ) VALUES (
      NEW.employee_id,
      NEW.company_id,
      'system',
      notification_title,
      notification_description,
      false,
      notification_link
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.stage32_notify_hr_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notifications (
    user_id, company_id, type, title, description, is_read, link
  )
  SELECT
    p.id,
    NEW.company_id,
    'system',
    'Novo documento de RH',
    format('O documento "%s" foi disponibilizado para você.', NEW.name),
    false,
    '/meu-rh'
  FROM public.profiles p
  WHERE p.company_id = NEW.company_id
    AND COALESCE(p.status, 'active') = 'active'
    AND (
      COALESCE(NEW.target_type, 'all') = 'all'
      OR (NEW.target_type = 'users' AND p.id = ANY(COALESCE(NEW.target_users, '{}'::uuid[])))
      OR (
        NEW.target_type = 'departments'
        AND p.department_id = ANY(COALESCE(NEW.target_departments, '{}'::uuid[]))
      )
    );

  RETURN NEW;
END;
$function$;

DO $block$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'hr_employee_benefits',
    'hr_time_bank',
    'hr_evaluations',
    'hr_payslips'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS stage32_notify_hr_assignment_trigger ON public.%I',
      target_table
    );
    EXECUTE format(
      'CREATE TRIGGER stage32_notify_hr_assignment_trigger AFTER INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.stage32_notify_hr_assignment()',
      target_table
    );
  END LOOP;
END
$block$;

DROP TRIGGER IF EXISTS stage32_notify_hr_document_trigger
ON public.hr_documents;

CREATE TRIGGER stage32_notify_hr_document_trigger
AFTER INSERT ON public.hr_documents
FOR EACH ROW
EXECUTE FUNCTION public.stage32_notify_hr_document();

REVOKE ALL ON FUNCTION public.stage32_notify_hr_assignment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stage32_notify_hr_document() FROM PUBLIC;

COMMIT;
