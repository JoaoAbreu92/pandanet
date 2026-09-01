BEGIN;

CREATE OR REPLACE FUNCTION public.chat_can_access_conversation(
    target_conversation_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
    SELECT
        public.is_platform_admin()
        OR EXISTS (
            SELECT 1
            FROM public.conversations c
            WHERE c.id = target_conversation_id
              AND (
                    public.is_company_admin(c.company_id)
                    OR (
                        c.company_id = public.get_user_company_id()
                        AND (
                            c.created_by = auth.uid()
                            OR EXISTS (
                                SELECT 1
                                FROM public.conversation_participants cp
                                WHERE cp.conversation_id = c.id
                                  AND cp.user_id = auth.uid()
                                  AND cp.company_id = c.company_id
                            )
                        )
                    )
              )
        );
$function$;

CREATE OR REPLACE FUNCTION public.chat_can_manage_conversation(
    target_conversation_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
    SELECT
        public.is_platform_admin()
        OR EXISTS (
            SELECT 1
            FROM public.conversations c
            WHERE c.id = target_conversation_id
              AND (
                    public.is_company_admin(c.company_id)
                    OR (
                        c.company_id = public.get_user_company_id()
                        AND c.created_by = auth.uid()
                    )
              )
        );
$function$;

REVOKE ALL ON FUNCTION public.chat_can_access_conversation(uuid)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.chat_can_manage_conversation(uuid)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.chat_can_access_conversation(uuid)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.chat_can_manage_conversation(uuid)
TO authenticated;

DO $block$
DECLARE
    existing_policy record;
BEGIN
    FOR existing_policy IN
        SELECT tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
              'conversations',
              'conversation_participants',
              'messages'
          )
    LOOP
        EXECUTE format(
            'DROP POLICY %I ON public.%I',
            existing_policy.policyname,
            existing_policy.tablename
        );
    END LOOP;
END
$block$;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_select_authorized
ON public.conversations
FOR SELECT
TO authenticated
USING (
    public.chat_can_access_conversation(id)
);

CREATE POLICY conversations_insert_authorized
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_platform_admin()
    OR (
        company_id = public.get_user_company_id()
        AND created_by = auth.uid()
    )
);

CREATE POLICY conversations_update_authorized
ON public.conversations
FOR UPDATE
TO authenticated
USING (
    public.chat_can_access_conversation(id)
)
WITH CHECK (
    public.chat_can_access_conversation(id)
    AND (
        public.is_platform_admin()
        OR company_id = public.get_user_company_id()
    )
);

CREATE POLICY conversations_delete_authorized
ON public.conversations
FOR DELETE
TO authenticated
USING (
    public.chat_can_manage_conversation(id)
);

CREATE POLICY participants_select_authorized
ON public.conversation_participants
FOR SELECT
TO authenticated
USING (
    public.chat_can_access_conversation(conversation_id)
);

CREATE POLICY participants_insert_authorized
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_platform_admin()
    OR (
        company_id = public.get_user_company_id()
        AND public.chat_can_access_conversation(conversation_id)
        AND EXISTS (
            SELECT 1
            FROM public.conversations c
            WHERE c.id = conversation_id
              AND c.company_id = company_id
        )
        AND EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = user_id
              AND p.company_id = company_id
        )
    )
);

CREATE POLICY participants_delete_authorized
ON public.conversation_participants
FOR DELETE
TO authenticated
USING (
    public.chat_can_manage_conversation(conversation_id)
    OR user_id = auth.uid()
);

CREATE POLICY messages_select_authorized
ON public.messages
FOR SELECT
TO authenticated
USING (
    public.chat_can_access_conversation(conversation_id)
);

CREATE POLICY messages_insert_authorized
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
    public.chat_can_access_conversation(conversation_id)
    AND (
        public.is_platform_admin()
        OR (
            sender_id = auth.uid()
            AND company_id = public.get_user_company_id()
        )
    )
    AND EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = conversation_id
          AND c.company_id = company_id
    )
);

CREATE POLICY messages_update_authorized
ON public.messages
FOR UPDATE
TO authenticated
USING (
    public.chat_can_access_conversation(conversation_id)
)
WITH CHECK (
    public.chat_can_access_conversation(conversation_id)
    AND (
        public.is_platform_admin()
        OR company_id = public.get_user_company_id()
    )
);

CREATE POLICY messages_delete_authorized
ON public.messages
FOR DELETE
TO authenticated
USING (
    public.chat_can_manage_conversation(conversation_id)
);

CREATE OR REPLACE FUNCTION public.guard_internal_chat_message_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
    IF public.is_platform_admin() THEN
        RETURN NEW;
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
       OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.text IS DISTINCT FROM OLD.text
       OR NEW.file_url IS DISTINCT FROM OLD.file_url
       OR NEW.file_type IS DISTINCT FROM OLD.file_type
       OR NEW.reply_to IS DISTINCT FROM OLD.reply_to
       OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
    THEN
        RAISE EXCEPTION
            'Campos imutáveis da mensagem não podem ser alterados';
    END IF;

    IF NEW.sender_deleted_at IS DISTINCT FROM OLD.sender_deleted_at
       AND OLD.sender_id <> auth.uid()
    THEN
        RAISE EXCEPTION
            'Somente o remetente pode remover sua própria mensagem';
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_internal_chat_message_update
ON public.messages;

CREATE TRIGGER guard_internal_chat_message_update
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.guard_internal_chat_message_update();

CREATE INDEX IF NOT EXISTS idx_conversations_company_last_message
ON public.conversations (
    company_id,
    last_message_at DESC
);

CREATE INDEX IF NOT EXISTS idx_conversations_direct_participants
ON public.conversations (
    company_id,
    participant1_id,
    participant2_id
)
WHERE is_group IS NOT TRUE;

CREATE INDEX IF NOT EXISTS idx_conversation_participants_user
ON public.conversation_participants (
    user_id,
    conversation_id
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
ON public.messages (
    conversation_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread
ON public.messages (
    receiver_id,
    conversation_id
)
WHERE is_read IS FALSE;

DO $block$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'conversation_participants'
    ) THEN
        ALTER PUBLICATION supabase_realtime
        ADD TABLE public.conversation_participants;
    END IF;
END
$block$;

DO $validation$
DECLARE
    policy_total integer;
BEGIN
    SELECT count(*)
    INTO policy_total
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
          'conversations',
          'conversation_participants',
          'messages'
      );

    IF policy_total <> 11 THEN
        RAISE EXCEPTION
            'Quantidade inesperada de políticas: %',
            policy_total;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
              'conversations',
              'conversation_participants',
              'messages'
          )
          AND 'public' = ANY(roles)
    ) THEN
        RAISE EXCEPTION
            'Ainda existem políticas atribuídas ao papel public';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'conversation_participants'
    ) THEN
        RAISE EXCEPTION
            'conversation_participants não entrou no Realtime';
    END IF;
END
$validation$;

COMMIT;
