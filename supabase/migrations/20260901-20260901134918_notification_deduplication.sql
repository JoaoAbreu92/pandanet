CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created
ON public.notifications (
    user_id,
    is_read,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_link_unread
ON public.notifications (
    user_id,
    link,
    is_read
);

CREATE OR REPLACE FUNCTION public.upsert_email_notification(
    target_user_id uuid,
    target_company_id uuid,
    notification_title text,
    notification_description text,
    notification_link text,
    notification_avatar_url text DEFAULT '/logo.png'
)
RETURNS public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    result_row public.notifications;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;

    IF target_user_id IS NULL
       OR target_user_id <> auth.uid()
    THEN
        RAISE EXCEPTION 'Destinatário inválido';
    END IF;

    IF target_company_id IS NULL
       OR NOT EXISTS (
           SELECT 1
           FROM public.profiles p
           WHERE p.id = auth.uid()
             AND p.company_id = target_company_id
       )
    THEN
        RAISE EXCEPTION 'Empresa inválida';
    END IF;

    IF notification_link IS NULL
       OR notification_link NOT LIKE '/email?accountId=%'
    THEN
        RAISE EXCEPTION 'Link de e-mail inválido';
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            target_user_id::text
            || ':'
            || notification_link,
            0
        )
    );

    SELECT n.*
    INTO result_row
    FROM public.notifications n
    WHERE n.user_id = target_user_id
      AND n.company_id = target_company_id
      AND n.type = 'system'
      AND n.link = notification_link
      AND n.title = notification_title
      AND n.is_read = false
    ORDER BY n.created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        UPDATE public.notifications
        SET
            description = notification_description,
            avatar_url = COALESCE(
                notification_avatar_url,
                avatar_url
            ),
            created_at = timezone('utc', now()),
            metadata = COALESCE(
                metadata,
                '{}'::jsonb
            ) || jsonb_build_object(
                'source',
                'email_notifier',
                'deduplicated',
                true,
                'updated_at',
                timezone('utc', now())
            )
        WHERE id = result_row.id
        RETURNING *
        INTO result_row;
    ELSE
        INSERT INTO public.notifications (
            user_id,
            company_id,
            type,
            title,
            description,
            is_read,
            avatar_url,
            link,
            metadata
        )
        VALUES (
            target_user_id,
            target_company_id,
            'system',
            notification_title,
            notification_description,
            false,
            COALESCE(
                notification_avatar_url,
                '/logo.png'
            ),
            notification_link,
            jsonb_build_object(
                'source',
                'email_notifier',
                'deduplicated',
                true
            )
        )
        RETURNING *
        INTO result_row;
    END IF;

    RETURN result_row;
END;
$function$;

REVOKE ALL
ON FUNCTION public.upsert_email_notification(
    uuid,
    uuid,
    text,
    text,
    text,
    text
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.upsert_email_notification(
    uuid,
    uuid,
    text,
    text,
    text,
    text
)
TO authenticated;
