-- CRITICAL: Drop the function first to ensure fresh creation
DROP FUNCTION IF EXISTS get_my_conversation_ids() CASCADE;

-- Drop ALL policies on conversation_participants to ensure clean slate
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can insert participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.conversation_participants;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.conversation_participants;
DROP POLICY IF EXISTS "policy_name" ON public.conversation_participants; -- Drop generic name if exists

-- Re-create the function with STRICT SECURITY DEFINER
CREATE OR REPLACE FUNCTION get_my_conversation_ids()
RETURNS setof uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT conversation_id
  FROM conversation_participants
  WHERE user_id = auth.uid()
$$;

-- Create the READ policy using the function
CREATE POLICY "Users can view participants of their conversations"
ON public.conversation_participants
FOR SELECT
USING (
  conversation_id IN (SELECT get_my_conversation_ids())
);

-- Create the INSERT policy
CREATE POLICY "Users can insert participants"
ON public.conversation_participants
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
);

-- Re-apply policies for Messages and Conversations to ensure they use the new function
DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
DROP POLICY IF EXISTS "Participants can insert messages" ON public.messages;

CREATE POLICY "Participants can view messages"
ON public.messages
FOR SELECT
USING (
  conversation_id IN (SELECT get_my_conversation_ids())
);

CREATE POLICY "Participants can insert messages"
ON public.messages
FOR INSERT
WITH CHECK (
  conversation_id IN (SELECT get_my_conversation_ids())
);

DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations"
ON public.conversations
FOR SELECT
USING (
  id IN (SELECT get_my_conversation_ids())
);
