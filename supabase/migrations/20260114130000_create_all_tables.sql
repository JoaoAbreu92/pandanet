-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- COMMUNICATION MODULE

CREATE TABLE public.announcements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    category TEXT CHECK (category IN ('Notícias da Empresa', 'Atualização de Produto', 'RH & Cultura', 'Evento')),
    date TIMESTAMP WITH TIME ZONE,
    image_url TEXT,
    video_url TEXT,
    reactions JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE public.banners (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    image_url TEXT NOT NULL,
    title TEXT,
    subtitle TEXT,
    link TEXT
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
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE public.messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES auth.users(id) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    text TEXT,
    file_url TEXT,
    file_type TEXT,
    reactions JSONB DEFAULT '[]'::jsonb
);

-- HR & CULTURE MODULE

CREATE TABLE public.recognitions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    from_user_id UUID REFERENCES auth.users(id) NOT NULL,
    to_user_id UUID REFERENCES auth.users(id) NOT NULL,
    message TEXT NOT NULL,
    value_tag TEXT CHECK (value_tag IN ('Trabalho em Equipe', 'Inovação', 'Foco no Cliente', 'Qualidade'))
);

CREATE TABLE public.benefits (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    link TEXT,
    features JSONB
);

CREATE TABLE public.onboarding_steps (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    link_url TEXT,
    link_text TEXT,
    "order" INTEGER DEFAULT 0
);

CREATE TABLE public.user_onboarding (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    step_id UUID REFERENCES public.onboarding_steps(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (user_id, step_id)
);

CREATE TABLE public.wellness_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK (category IN ('Saúde Mental', 'Atividade Física', 'Nutrição', 'Outro')),
    video_url TEXT,
    link_url TEXT
);

-- PRODUCTIVITY & OPERATIONS MODULE

CREATE TABLE public.marketplace_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    listed_by UUID REFERENCES auth.users(id) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    price NUMERIC,
    category TEXT,
    condition TEXT CHECK (condition IN ('Novo', 'Quase Novo', 'Bom', 'Usado')),
    status TEXT CHECK (status IN ('Disponível', 'Reservado', 'Vendido')) DEFAULT 'Disponível',
    image_urls JSONB DEFAULT '[]'::jsonb,
    reserved_by UUID REFERENCES auth.users(id)
);

CREATE TABLE public.form_submissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    requester_id UUID REFERENCES auth.users(id) NOT NULL,
    form_type TEXT NOT NULL,
    status TEXT CHECK (status IN ('Pendente', 'Aprovado', 'Rejeitado')) DEFAULT 'Pendente',
    data JSONB NOT NULL -- Stores start_date, end_date, reason, etc.
);

CREATE TABLE public.ti_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    requester_id UUID REFERENCES auth.users(id) NOT NULL,
    request_type TEXT CHECK (request_type IN ('Hardware', 'Software')),
    item_name TEXT NOT NULL,
    justification TEXT,
    status TEXT CHECK (status IN ('Pendente', 'Em Análise', 'Aprovado', 'Pedido Realizado', 'Entregue', 'Rejeitado')) DEFAULT 'Pendente'
);

-- KNOWLEDGE & TRAINING MODULE

CREATE TABLE public.trainings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    duration TEXT,
    thumbnail_url TEXT,
    video_url TEXT,
    category TEXT
);

CREATE TABLE public.kb_articles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    category TEXT,
    views INTEGER DEFAULT 0,
    media_url TEXT,
    media_type TEXT
);

CREATE TABLE public.policies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    version TEXT
);

-- UTILITIES MODULE

CREATE TABLE public.polls (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    question TEXT NOT NULL,
    active BOOLEAN DEFAULT true
);

CREATE TABLE public.poll_options (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    text TEXT NOT NULL
);

CREATE TABLE public.poll_votes (
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
    option_id UUID REFERENCES public.poll_options(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    PRIMARY KEY (poll_id, user_id)
);

CREATE TABLE public.service_status (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    status TEXT CHECK (status IN ('operational', 'maintenance', 'outage')),
    uptime TEXT
);

CREATE TABLE public.security_alerts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    level TEXT CHECK (level IN ('info', 'warning', 'critical')),
    date TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ROW LEVEL SECURITY (RLS) POLICIES

DO $$DECLARE r record;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
        'announcements', 'banners', 'conversations', 'conversation_participants', 'messages',
        'recognitions', 'benefits', 'onboarding_steps', 'user_onboarding', 'wellness_items',
        'marketplace_items', 'form_submissions', 'ti_requests', 'trainings', 'kb_articles',
        'policies', 'polls', 'poll_options', 'poll_votes', 'service_status', 'security_alerts'
    ) LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
        
        -- Drop existing policies to avoid errors on re-run
        EXECUTE format('DROP POLICY IF EXISTS "View own company data" ON public.%I', r.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Insert own company data" ON public.%I', r.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Update own company data" ON public.%I', r.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Delete own company data" ON public.%I', r.tablename);
        
        -- Policy: View rows belonging to own company
        EXECUTE format('CREATE POLICY "View own company data" ON public.%I FOR SELECT USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()))', r.tablename);
        
        -- Policy: Insert rows for own company
        EXECUTE format('CREATE POLICY "Insert own company data" ON public.%I FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()))', r.tablename);
        
        -- Policy: Update rows for own company
        EXECUTE format('CREATE POLICY "Update own company data" ON public.%I FOR UPDATE USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()))', r.tablename);
        
        -- Policy: Delete rows for own company
        EXECUTE format('CREATE POLICY "Delete own company data" ON public.%I FOR DELETE USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()))', r.tablename);
    END LOOP;
END$$;
