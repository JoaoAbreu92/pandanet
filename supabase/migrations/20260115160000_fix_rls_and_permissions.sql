-- Fix infinite recursion in conversation_participants
-- Create a security definer function to get conversation IDs safely
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

-- Drop potentially problematic policies to reset them
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can insert participants" ON public.conversation_participants;

DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
DROP POLICY IF EXISTS "Participants can insert messages" ON public.messages;

DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

DROP POLICY IF EXISTS "View banners" ON public.banners;
DROP POLICY IF EXISTS "Manage banners" ON public.banners;

DROP POLICY IF EXISTS "View announcements" ON public.announcements;
DROP POLICY IF EXISTS "Manage announcements" ON public.announcements;

DROP POLICY IF EXISTS "View marketplace items" ON public.marketplace_items;
DROP POLICY IF EXISTS "Manage marketplace items" ON public.marketplace_items;

-- 1. Conversation Participants
CREATE POLICY "Users can view participants of their conversations"
ON public.conversation_participants
FOR SELECT
USING (
  conversation_id IN (SELECT get_my_conversation_ids())
);

CREATE POLICY "Users can insert participants"
ON public.conversation_participants
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
);

-- 2. Conversations
CREATE POLICY "Participants can view conversations"
ON public.conversations
FOR SELECT
USING (
  id IN (SELECT get_my_conversation_ids())
);

CREATE POLICY "Users can create conversations"
ON public.conversations
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
);

-- 3. Messages
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

-- 4. Profiles (Fix 'Follow User' error)
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING ( id = auth.uid() );

-- 5. Banners (Fix 'Save Banner' error)
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View banners" ON public.banners FOR SELECT USING (true);
CREATE POLICY "Manage banners" ON public.banners FOR ALL USING ( auth.role() = 'authenticated' );

-- 6. Announcements (Fix 'Save Announcement' error)
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View announcements" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Manage announcements" ON public.announcements FOR ALL USING ( auth.role() = 'authenticated' );

-- 7. Marketplace Items (Fix 'Save Item' error)
ALTER TABLE public.marketplace_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View marketplace items" ON public.marketplace_items FOR SELECT USING (true);
CREATE POLICY "Manage marketplace items" ON public.marketplace_items FOR ALL USING ( auth.role() = 'authenticated' );
