-- 1. Add data column to companies for Marketplace and other modules
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- 2. Add comments column to tickets for chat functionality
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]'::jsonb;

-- 3. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL, -- 'message', 'ticket', 'event', 'mention', etc.
    title TEXT NOT NULL,
    description TEXT,
    is_read BOOLEAN DEFAULT false,
    avatar_url TEXT,
    link TEXT, -- Link to navigate to when clicked
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 4. Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 5. Policies for notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" 
ON public.notifications FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" 
ON public.notifications FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System/Users can insert notifications" ON public.notifications;
CREATE POLICY "System/Users can insert notifications" 
ON public.notifications FOR INSERT 
TO authenticated 
WITH CHECK (true);
