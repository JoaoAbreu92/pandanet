-- FRESH START MIGRATION
-- Drops everything and rebuilds the schema from scratch.

-- 1. DROP EXISTING SCHEMA
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CORE TABLES (Plans, Companies, Profiles)

CREATE TABLE public.plans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    user_limit INTEGER NOT NULL,
    features JSONB NOT NULL,
    type TEXT NOT NULL
);

CREATE TABLE public.companies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    domain TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, active, suspended
    plan_id UUID REFERENCES public.plans(id),
    responsible_name TEXT,
    responsible_email TEXT,
    custom_features JSONB, -- For toggling modules
    subscription_end_date TIMESTAMP WITH TIME ZONE
);

CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    updated_at TIMESTAMP WITH TIME ZONE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    full_name TEXT,
    email TEXT,
    role TEXT DEFAULT 'employee', -- admin, employee
    team TEXT,
    avatar_url TEXT,
    cover_url TEXT,
    bio TEXT,
    phone TEXT,
    office_location TEXT,
    permissions JSONB DEFAULT '{}'::jsonb,
    join_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. SOCIAL FEED

CREATE TABLE public.posts (
    id SERIAL PRIMARY KEY, -- Legacy int ID kept for frontend compat or switch to UUID? Frontend uses number for posts. Keeping SERIAL for now as per `FeedPage.tsx`.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    content TEXT,
    media_url TEXT,
    media_type TEXT DEFAULT 'image',
    mentions UUID[] DEFAULT '{}',
    likes INTEGER DEFAULT 0 -- Deprecated by reactions but kept for compat
);

CREATE TABLE public.post_reactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    post_id INTEGER REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    emoji TEXT NOT NULL,
    UNIQUE(post_id, user_id)
);

CREATE TABLE public.comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    post_id INTEGER REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL
);

-- 4. COMMUNICATION

CREATE TABLE public.announcements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    category TEXT,
    date TIMESTAMP WITH TIME ZONE,
    image_url TEXT,
    video_url TEXT,
    reactions JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE public.conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    is_group BOOLEAN DEFAULT false,
    group_name TEXT,
    last_message TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE public.conversation_participants (
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE public.messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    text TEXT,
    file_url TEXT,
    file_type TEXT,
    reactions JSONB DEFAULT '[]'::jsonb
);

-- 5. HR & UTILITIES

CREATE TABLE public.events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    location TEXT,
    type TEXT,
    attendees UUID[] DEFAULT '{}',
    declined UUID[] DEFAULT '{}' -- Added missing field
);

CREATE TABLE public.tickets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'open',
    priority TEXT DEFAULT 'medium',
    assigned_to UUID REFERENCES public.profiles(id),
    created_by UUID REFERENCES public.profiles(id)
);

CREATE TABLE public.benefits (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    link TEXT,
    features JSONB
);

CREATE TABLE public.wellness_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    video_url TEXT,
    link_url TEXT
);

CREATE TABLE public.kb_articles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    category TEXT,
    views INTEGER DEFAULT 0,
    media_url TEXT,
    media_type TEXT
);

CREATE TABLE public.onboarding_steps (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    link_url TEXT,
    link_text TEXT,
    "order" INTEGER DEFAULT 0
);

CREATE TABLE public.user_onboarding (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    step_id UUID REFERENCES public.onboarding_steps(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (user_id, step_id)
);

-- 6. SECURITY & STORAGE

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
-- (Enable for all others as needed, keeping it simple for now)

-- RLS POLICIES (Simplified for Launch Stability)

-- Companies: Visible to Authenticated (for creating/joining)
CREATE POLICY "Auth View Companies" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth Update Companies" ON public.companies FOR UPDATE TO authenticated USING (true); -- Ideally restrict to responsible
CREATE POLICY "Auth Insert Companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (true);

-- Profiles: View All (Directory), Update Own
CREATE POLICY "View Profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Update Own Profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Insert Own Profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Posts: View/Create if Auth (refining by Company ID happens in frontend query usually, but good to enforce)
-- For "Fresh Start", let's open it up to "Same Company" logic.
CREATE POLICY "View Company Posts" ON public.posts FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Insert Company Posts" ON public.posts FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('feed-media', 'feed-media', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('announcements-media', 'announcements-media', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('message-attachments', 'message-attachments', true) ON CONFLICT (id) DO UPDATE SET public = true;

-- STORAGE POLICIES (Public Read, Auth Write)
DROP POLICY IF EXISTS "Public Read 1" ON storage.objects;
CREATE POLICY "Public Read 1" ON storage.objects FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Auth Upload 1" ON storage.objects;
CREATE POLICY "Auth Upload 1" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('avatars', 'covers', 'feed-media', 'announcements-media', 'message-attachments'));

-- 7. TRIGGERS

-- Handle New User (Auto-assign Company & Role)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    v_company_id UUID;
    v_role TEXT := 'employee';
    v_email_domain TEXT;
    v_resp_email TEXT;
BEGIN
    -- Extract domain
    v_email_domain := split_part(NEW.email, '@', 2);

    -- Find company by domain
    SELECT id, responsible_email INTO v_company_id, v_resp_email
    FROM public.companies 
    WHERE domain IS NOT NULL AND lower(domain) = lower(v_email_domain)
    LIMIT 1;

    -- Check if admin
    IF v_resp_email IS NOT NULL AND lower(v_resp_email) = lower(NEW.email) THEN
        v_role := 'admin';
    END IF;

    -- Insert Profile
    INSERT INTO public.profiles (id, full_name, email, company_id, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        v_company_id,
        v_role
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        company_id = COALESCE(public.profiles.company_id, EXCLUDED.company_id),
        role = CASE WHEN public.profiles.role = 'admin' THEN 'admin' ELSE EXCLUDED.role END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger Attach
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed Default Plans
INSERT INTO public.plans (name, price, user_limit, features, type) VALUES
('Starter', 299, 10, '["Core Features", "5GB Storage"]'::jsonb, 'monthly'),
('Business', 599, 50, '["All Features", "20GB Storage", "Priority Support"]'::jsonb, 'monthly'),
('Enterprise', 1500, 1000, '["Unlimited Features", "Unlimited Storage", "Dedicated Manager"]'::jsonb, 'monthly');

-- Grant Permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role;
