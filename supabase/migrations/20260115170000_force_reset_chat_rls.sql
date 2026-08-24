-- FORCE RESET: Dynamically drop ALL policies on chat tables to ensure no "zombie" policies remain.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('conversation_participants', 'messages', 'conversations')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- Drop function if exists
DROP FUNCTION IF EXISTS get_my_conversation_ids() CASCADE;
DROP FUNCTION IF EXISTS get_safe_conversation_ids() CASCADE;

-- Re-create the secure lookup function
CREATE OR REPLACE FUNCTION get_safe_conversation_ids()
RETURNS setof uuid
LANGUAGE sql
SECURITY DEFINER -- Runs as database owner, BYPASSING RLS
SET search_path = public
STABLE
AS $$
  -- Only look at user_id to avoid recursion into conversation_id checks
  SELECT conversation_id
  FROM conversation_participants
  WHERE user_id = auth.uid()
$$;

-- 1. Conversas (Conversations)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create conversations"
ON public.conversations
FOR INSERT
WITH CHECK ( auth.role() = 'authenticated' );

CREATE POLICY "Users can view their conversations"
ON public.conversations
FOR SELECT
USING (
  id IN (SELECT get_safe_conversation_ids())
);

-- 2. Participantes (Conversation Participants)
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Allow users to see WHO is in their conversations
CREATE POLICY "Users can view participants"
ON public.conversation_participants
FOR SELECT
USING (
  conversation_id IN (SELECT get_safe_conversation_ids())
);

-- Allow users to add participants (usually themselves or others when starting)
CREATE POLICY "Users can add participants"
ON public.conversation_participants
FOR INSERT
WITH CHECK ( auth.role() = 'authenticated' );

-- 3. Mensagens (Messages)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their chats"
ON public.messages
FOR SELECT
USING (
  conversation_id IN (SELECT get_safe_conversation_ids())
);

CREATE POLICY "Users can send messages to their chats"
ON public.messages
FOR INSERT
WITH CHECK (
  conversation_id IN (SELECT get_safe_conversation_ids())
);
