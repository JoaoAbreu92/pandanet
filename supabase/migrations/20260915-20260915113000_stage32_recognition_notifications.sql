BEGIN;

CREATE OR REPLACE FUNCTION public.stage32_notify_recognition()
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
    NEW.to_id,
    NEW.company_id,
    'mention',
    'Novo Reconhecimento!',
    format('%s reconheceu você: "%s"', sender.full_name, NEW.message),
    false,
    '/'
  FROM public.profiles sender
  JOIN public.profiles recipient
    ON recipient.id = NEW.to_id
   AND recipient.company_id = NEW.company_id
  WHERE sender.id = NEW.from_id
    AND sender.company_id = NEW.company_id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS stage32_notify_recognition_trigger
ON public.recognitions;

CREATE TRIGGER stage32_notify_recognition_trigger
AFTER INSERT ON public.recognitions
FOR EACH ROW
EXECUTE FUNCTION public.stage32_notify_recognition();

REVOKE ALL ON FUNCTION public.stage32_notify_recognition() FROM PUBLIC;

COMMIT;
