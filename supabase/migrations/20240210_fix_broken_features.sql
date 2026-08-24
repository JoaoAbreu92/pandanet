-- Create training_modules table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.training_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    duration TEXT,
    thumbnail TEXT,
    video_url TEXT,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies for training_modules
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'training_modules' AND policyname = 'Users can view their company trainings') THEN
        CREATE POLICY "Users can view their company trainings" ON public.training_modules
        FOR SELECT USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
    END IF;
END $$;

-- Fix for polls (missing table or RLS)
CREATE TABLE IF NOT EXISTS public.polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'polls' AND policyname = 'Everyone in company can view active polls') THEN
        CREATE POLICY "Everyone in company can view active polls" ON public.polls
        FOR SELECT USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
    END IF;
END $$;

-- Fix for events (RLS 403)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'Users can view company events') THEN
        CREATE POLICY "Users can view company events" ON public.events
        FOR SELECT USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
    END IF;
END $$;

-- Fix for post_reactions
CREATE TABLE IF NOT EXISTS public.post_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(post_id, user_id)
);

ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'post_reactions' AND policyname = 'Users can manage their own reactions') THEN
        CREATE POLICY "Users can manage their own reactions" ON public.post_reactions
        FOR ALL USING (user_id = auth.uid());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'post_reactions' AND policyname = 'Users can view company reactions') THEN
        CREATE POLICY "Users can view company reactions" ON public.post_reactions
        FOR SELECT USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
    END IF;
END $$;
