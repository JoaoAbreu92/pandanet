BEGIN;

UPDATE public.notifications
SET link = CASE
  WHEN lower(title) LIKE '%benef%' THEN '/meu-rh?section=benefits'
  WHEN lower(title) LIKE '%document%' THEN '/meu-rh?section=documents'
  WHEN lower(title) LIKE '%avalia%' OR lower(title) LIKE '%meta%' THEN '/meu-rh?section=performance'
  WHEN lower(title) LIKE '%banco de horas%' OR lower(title) LIKE '%hora%' THEN '/meu-rh?section=timebank'
  WHEN lower(title) LIKE '%holerite%' OR lower(title) LIKE '%pagamento%' THEN '/meu-rh?section=payroll'
  WHEN lower(title) LIKE '%férias%' OR lower(title) LIKE '%ferias%' THEN '/meu-rh?section=vacation'
  ELSE '/meu-rh?section=requests'
END
WHERE is_read = false AND link IN ('/meu-rh', 'meu-rh');

CREATE OR REPLACE FUNCTION public.stage33_notify_form_submission_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications(user_id, company_id, type, title, description, is_read, link, metadata)
    VALUES (
      NEW.requester_id,
      NEW.company_id,
      'system',
      'Solicitação atualizada',
      format('A solicitação "%s" agora está com status %s.', NEW.form_type, NEW.status),
      false,
      '/meu-rh?section=requests',
      jsonb_build_object('submission_id', NEW.id, 'section', 'requests')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stage33_form_submission_status_notification ON public.form_submissions;
CREATE TRIGGER stage33_form_submission_status_notification
AFTER UPDATE OF status ON public.form_submissions
FOR EACH ROW EXECUTE FUNCTION public.stage33_notify_form_submission_status();

COMMIT;
