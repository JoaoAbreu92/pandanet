BEGIN;

CREATE OR REPLACE FUNCTION public.chat_can_access_conversation(
    target_conversation_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.conversations c
        JOIN public.conversation_participants cp
          ON cp.conversation_id = c.id
         AND cp.company_id = c.company_id
        WHERE c.id = target_conversation_id
          AND cp.user_id = auth.uid()
    );
$function$;

REVOKE ALL ON FUNCTION public.chat_can_access_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_can_access_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_can_access_conversation(uuid) TO service_role;

DROP POLICY IF EXISTS participants_insert_authorized
ON public.conversation_participants;

CREATE POLICY participants_insert_authorized
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.chat_can_access_conversation(conversation_id)
    AND EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = conversation_participants.conversation_id
          AND c.company_id = conversation_participants.company_id
    )
    AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = conversation_participants.user_id
          AND p.company_id = conversation_participants.company_id
    )
);

DROP POLICY IF EXISTS messages_insert_authorized
ON public.messages;

CREATE POLICY messages_insert_authorized
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = auth.uid()
    AND public.chat_can_access_conversation(conversation_id)
    AND EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND c.company_id = messages.company_id
    )
);

COMMIT;
