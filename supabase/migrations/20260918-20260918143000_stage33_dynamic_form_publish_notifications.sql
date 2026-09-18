BEGIN;

CREATE OR REPLACE FUNCTION public.stage33_notify_dynamic_form_publication()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'published'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    INSERT INTO public.notifications (
      user_id,
      company_id,
      type,
      title,
      description,
      is_read,
      link,
      metadata
    )
    SELECT
      profile.id,
      NEW.company_id,
      'form',
      'Novo formulário disponível',
      format('O formulário "%s" está disponível para preenchimento.', NEW.title),
      false,
      '/meu-rh?section=requests&formId=' || NEW.id::text,
      jsonb_build_object(
        'template_id', NEW.id,
        'section', 'requests',
        'notification_path', jsonb_build_array('rh', 'meu-rh', 'requests')
      )
    FROM public.profiles profile
    WHERE profile.company_id = NEW.company_id
      AND COALESCE(profile.status, 'active') = 'active'
      AND COALESCE((profile.permissions ->> 'viewForms')::boolean, false)
      AND (
        NEW.audience_type = 'company'
        OR (
          NEW.audience_type = 'departments'
          AND profile.department_id = ANY(NEW.department_ids)
        )
        OR (
          NEW.audience_type = 'users'
          AND profile.id = ANY(NEW.user_ids)
        )
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stage33_dynamic_form_publication_notification
ON public.dynamic_form_templates;

CREATE TRIGGER stage33_dynamic_form_publication_notification
AFTER INSERT OR UPDATE OF status
ON public.dynamic_form_templates
FOR EACH ROW
EXECUTE FUNCTION public.stage33_notify_dynamic_form_publication();

INSERT INTO public.notifications (
  user_id, company_id, type, title, description, is_read, link, metadata
)
SELECT
  profile.id,
  form.company_id,
  'form',
  'Novo formulário disponível',
  format('O formulário "%s" está disponível para preenchimento.', form.title),
  false,
  '/meu-rh?section=requests&formId=' || form.id::text,
  jsonb_build_object(
    'template_id', form.id,
    'section', 'requests',
    'notification_path', jsonb_build_array('rh', 'meu-rh', 'requests')
  )
FROM public.dynamic_form_templates form
JOIN public.profiles profile ON profile.company_id = form.company_id
WHERE form.status = 'published'
  AND COALESCE(profile.status, 'active') = 'active'
  AND COALESCE((profile.permissions ->> 'viewForms')::boolean, false)
  AND (
    form.audience_type = 'company'
    OR (form.audience_type = 'departments' AND profile.department_id = ANY(form.department_ids))
    OR (form.audience_type = 'users' AND profile.id = ANY(form.user_ids))
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications notification
    WHERE notification.user_id = profile.id
      AND notification.metadata ->> 'template_id' = form.id::text
  );

COMMIT;
