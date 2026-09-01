BEGIN;

INSERT INTO storage.buckets (
    id,
    name,
    public,
    file_size_limit
)
VALUES (
    'message-attachments',
    'message-attachments',
    false,
    209715200
)
ON CONFLICT (id)
DO UPDATE SET
    public = false,
    file_size_limit = 209715200;

CREATE OR REPLACE FUNCTION public.internal_chat_attachment_allowed(
    object_name text,
    object_metadata jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $function$
DECLARE
    path_company_id uuid;
    path_user_id uuid;
    path_conversation_id uuid;
    user_company_id uuid;
    attachments_enabled boolean;
    maximum_mb integer;
    object_size bigint;
BEGIN
    BEGIN
        path_company_id :=
            split_part(object_name, '/', 1)::uuid;

        path_user_id :=
            split_part(object_name, '/', 2)::uuid;

        path_conversation_id :=
            split_part(object_name, '/', 3)::uuid;
    EXCEPTION
        WHEN OTHERS THEN
            RETURN false;
    END;

    IF path_user_id <> auth.uid() THEN
        RETURN false;
    END IF;

    SELECT
        p.company_id,
        COALESCE(
            (p.permissions ->> 'canSendChatAttachments')::boolean,
            true
        ),
        LEAST(
            200,
            GREATEST(
                1,
                COALESCE(
                    (p.permissions ->> 'chatAttachmentMaxMb')::integer,
                    10
                )
            )
        )
    INTO
        user_company_id,
        attachments_enabled,
        maximum_mb
    FROM public.profiles p
    WHERE p.id = auth.uid();

    IF user_company_id IS NULL
       OR user_company_id <> path_company_id
       OR NOT attachments_enabled
    THEN
        RETURN false;
    END IF;

    IF NOT public.chat_can_access_conversation(
        path_conversation_id
    ) THEN
        RETURN false;
    END IF;

    object_size :=
        COALESCE(
            NULLIF(object_metadata ->> 'size', '')::bigint,
            NULLIF(object_metadata ->> 'contentLength', '')::bigint,
            NULLIF(
                object_metadata ->> 'content-length',
                ''
            )::bigint,
            0
        );

    IF object_size > 0
       AND object_size > maximum_mb::bigint * 1024 * 1024
    THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$function$;

REVOKE ALL
ON FUNCTION public.internal_chat_attachment_allowed(text, jsonb)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.internal_chat_attachment_allowed(text, jsonb)
TO authenticated;

DROP POLICY IF EXISTS
    "message_attachments_select_participants"
ON storage.objects;

DROP POLICY IF EXISTS
    "message_attachments_insert_sender"
ON storage.objects;

DROP POLICY IF EXISTS
    "message_attachments_update_sender"
ON storage.objects;

DROP POLICY IF EXISTS
    "message_attachments_delete_sender_or_manager"
ON storage.objects;

CREATE POLICY "message_attachments_select_participants"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'message-attachments'
    AND public.chat_can_access_conversation(
        split_part(name, '/', 3)::uuid
    )
);

CREATE POLICY "message_attachments_insert_sender"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'message-attachments'
    AND public.internal_chat_attachment_allowed(
        name,
        metadata
    )
);

CREATE POLICY "message_attachments_update_sender"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'message-attachments'
    AND split_part(name, '/', 2)::uuid = auth.uid()
    AND public.chat_can_access_conversation(
        split_part(name, '/', 3)::uuid
    )
)
WITH CHECK (
    bucket_id = 'message-attachments'
    AND public.internal_chat_attachment_allowed(
        name,
        metadata
    )
);

CREATE POLICY "message_attachments_delete_sender_or_manager"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'message-attachments'
    AND (
        split_part(name, '/', 2)::uuid = auth.uid()
        OR public.chat_can_manage_conversation(
            split_part(name, '/', 3)::uuid
        )
    )
);

COMMIT;
