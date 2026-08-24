-- PANDANET DATABASE CALIBRATION SCRIPT
-- This script ensures all tables, columns, constraints, and RLS policies are correctly configured.
-- It is designed to be IDEMPOTENT (safe to run multiple times).

-- ENABLE VECTORS IF NEEDED (For future KB search)
CREATE EXTENSION IF NOT EXISTS vector;

--------------------------------------------------------------------------------
-- 0. HELPER FUNCTIONS & TYPES
--------------------------------------------------------------------------------

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to get current user company_id
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE;

-- Function to check if current user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'Super Admin'
  ) OR (
    auth.jwt() ->> 'email' = 'ti@grupopixel.com.br'
  );
END;
$$;

--------------------------------------------------------------------------------
-- 1. CORE INFRASTRUCTURE (Plans, Companies, Profiles)
--------------------------------------------------------------------------------

-- 1.1 PLANS
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    user_limit INTEGER DEFAULT 50,
    price DECIMAL(10, 2) DEFAULT 0.00,
    features JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2 COMPANIES
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT UNIQUE NOT NULL,
    cnpj TEXT,
    plan_id UUID REFERENCES public.plans(id),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
    subscription_end_date TIMESTAMPTZ,
    responsible_name TEXT,
    responsible_email TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    custom_features JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.3 PROFILES (EXTENDED USER DATA)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    cover_url TEXT,
    role TEXT DEFAULT 'Employee',
    team TEXT,
    department_id UUID, -- Will be linked after departments table created
    is_admin BOOLEAN DEFAULT FALSE,
    is_company_admin BOOLEAN DEFAULT FALSE,
    join_date DATE DEFAULT CURRENT_DATE,
    birth_date DATE,
    phone TEXT,
    office_location TEXT,
    bio TEXT,
    address TEXT,
    following UUID[] DEFAULT '{}',
    permissions JSONB DEFAULT '{}'::jsonb,
    whatspanda_permissions JSONB DEFAULT '{}'::jsonb,
    -- Personal Data (RH)
    rg TEXT,
    cpf TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    health_insurance TEXT,
    blood_type TEXT,
    marital_status TEXT,
    education_level TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

--------------------------------------------------------------------------------
-- 2. SAAS MANAGEMENT (Settings, Updates, Videos)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    changes TEXT[] DEFAULT '{}',
    date DATE DEFAULT CURRENT_DATE,
    is_beta BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.manual_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    title TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    thumbnail TEXT,
    duration TEXT,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

--------------------------------------------------------------------------------
-- 3. HUMAN RESOURCES (Benefits, Jobs, Forms, Docs)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.benefits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    title TEXT NOT NULL,
    description TEXT,
    features TEXT[] DEFAULT '{}',
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wellness_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    video_url TEXT,
    link_url TEXT,
    link_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.training_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    title TEXT NOT NULL,
    description TEXT,
    thumbnail TEXT,
    video_url TEXT,
    category TEXT,
    duration TEXT,
    participants UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    title TEXT NOT NULL,
    description TEXT,
    requirements TEXT[] DEFAULT '{}',
    location TEXT,
    salary_range TEXT,
    type TEXT CHECK (type IN ('Full-time', 'Part-time', 'Contract', 'Internship')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'interviewing', 'accepted', 'rejected')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    requester_id UUID REFERENCES public.profiles(id),
    form_type TEXT NOT NULL,
    status TEXT DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Aprovado', 'Rejeitado')),
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    start_date DATE,
    end_date DATE,
    reason TEXT,
    details JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.recognitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    from_id UUID REFERENCES public.profiles(id),
    to_id UUID REFERENCES public.profiles(id),
    message TEXT NOT NULL,
    value TEXT NOT NULL, -- e.g., 'Trabalho em Equipe'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    title TEXT NOT NULL,
    category TEXT,
    type TEXT CHECK (type IN ('PDF', 'DOCX', 'PPTX', 'XLSX', 'OUTRO')),
    url TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

--------------------------------------------------------------------------------
-- 4. SOCIAL & COMMUNICATION (Feed, Messages, Notifications)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    author_id UUID REFERENCES public.profiles(id),
    content TEXT NOT NULL,
    media_url TEXT,
    media_type TEXT CHECK (media_type IN ('image', 'video')),
    mentions UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    author_id UUID REFERENCES public.profiles(id),
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.post_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id),
    emoji TEXT NOT NULL,
    UNIQUE(post_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    title TEXT NOT NULL,
    summary TEXT,
    category TEXT,
    image_url TEXT,
    video_url TEXT,
    video_file TEXT,
    reactions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    image_url TEXT NOT NULL,
    title TEXT,
    subtitle TEXT,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CHAT INFRASTRUCTURE
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    is_group BOOLEAN DEFAULT FALSE,
    group_name TEXT,
    last_message TEXT,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    is_closed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_admin BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id),
    company_id UUID REFERENCES public.companies(id),
    text TEXT,
    file_url TEXT,
    file_type TEXT,
    reactions JSONB DEFAULT '[]'::jsonb,
    reply_to UUID REFERENCES public.messages(id),
    sender_deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.nudges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES public.profiles(id),
    receiver_id UUID REFERENCES public.profiles(id),
    conversation_id UUID REFERENCES public.conversations(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    link TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

--------------------------------------------------------------------------------
-- 5. T.I. & OPERATIONS (Tickets, TI Requests, KB, KPIs, Marketplace, Polls)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    requester_id UUID REFERENCES public.profiles(id),
    assigned_user_id UUID REFERENCES public.profiles(id),
    department_id UUID REFERENCES public.departments(id),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Aberto' CHECK (status IN ('Aberto', 'Em Andamento', 'Pendente', 'Resolvido', 'Fechado')),
    priority TEXT DEFAULT 'Média' CHECK (priority IN ('Baixa', 'Média', 'Alta', 'Urgente')),
    rating INTEGER,
    resolution_note TEXT,
    media_urls TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ticket_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
    author_id UUID REFERENCES public.profiles(id),
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ti_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    requester_id UUID REFERENCES public.profiles(id),
    assigned_user_id UUID REFERENCES public.profiles(id),
    request_type TEXT CHECK (request_type IN ('Hardware', 'Software')),
    item_name TEXT NOT NULL,
    justification TEXT,
    status TEXT DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Em Análise', 'Aprovado', 'Pedido Realizado', 'Entregue', 'Rejeitado', 'Finalizado')),
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kb_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    title TEXT NOT NULL,
    category TEXT,
    content TEXT,
    views INTEGER DEFAULT 0,
    media_url TEXT,
    media_type TEXT CHECK (media_type IN ('image', 'video')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kpis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    name TEXT NOT NULL,
    target DECIMAL(15, 2) NOT NULL,
    current DECIMAL(15, 2) DEFAULT 0.00,
    unit TEXT,
    category TEXT,
    period TEXT,
    powerbi_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.marketplace_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    listed_by UUID REFERENCES public.profiles(id),
    title TEXT NOT NULL,
    description TEXT,
    price DECIMAL(15, 2) NOT NULL,
    category TEXT,
    condition TEXT CHECK (condition IN ('Novo', 'Quase Novo', 'Bom', 'Usado')),
    image_urls TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'Disponível' CHECK (status IN ('Disponível', 'Reservado', 'Vendido')),
    reserved_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    question TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.poll_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    votes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
    option_id UUID REFERENCES public.poll_options(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    UNIQUE(poll_id, user_id)
);

--------------------------------------------------------------------------------
-- 6. WHATSAPP INTEGRATION (WhatsPanda)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) UNIQUE,
    connection_name TEXT,
    phone_number TEXT,
    reject_calls BOOLEAN DEFAULT FALSE,
    rejection_message TEXT,
    is_connected BOOLEAN DEFAULT FALSE,
    qr_code TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    contact_name TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto', 'pendente', 'fechado')),
    assigned_to UUID REFERENCES public.profiles(id),
    department_id UUID REFERENCES public.departments(id),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    message_text TEXT,
    media_url TEXT,
    media_type TEXT,
    is_from_customer BOOLEAN DEFAULT TRUE,
    sent_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    notes TEXT,
    queue_id UUID REFERENCES public.whatsapp_queues(id),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_agent_queues (
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    queue_id UUID REFERENCES public.whatsapp_queues(id) ON DELETE CASCADE,
    PRIMARY KEY (profile_id, queue_id)
);

--------------------------------------------------------------------------------
-- 7. CALENDAR & EVENTS
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    title TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    time TEXT,
    location TEXT,
    image_url TEXT,
    category TEXT CHECK (category IN ('Social', 'Corporativo', 'Treinamento', 'Outro')),
    attendees UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    creator_id UUID REFERENCES public.profiles(id),
    title TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    start_time TEXT,
    end_time TEXT,
    category TEXT,
    location TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.calendar_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.calendar_events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    decline_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

--------------------------------------------------------------------------------
-- 8. EMAIL INTEGRATION
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.email_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id),
    imap_host TEXT,
    imap_port INTEGER,
    imap_user TEXT,
    imap_pass TEXT,
    imap_ssl BOOLEAN DEFAULT TRUE,
    smtp_host TEXT,
    smtp_port INTEGER,
    smtp_user TEXT,
    smtp_pass TEXT,
    smtp_ssl BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id),
    subject TEXT,
    body TEXT,
    from_addr TEXT,
    to_addr TEXT,
    sent_at TIMESTAMPTZ,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

--------------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) - TENANT ISOLATION
--------------------------------------------------------------------------------

-- Enable RLS on all tables
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY';
    END LOOP;
END $$;

-- GENERIC POLICY TEMPLATE (Adjust as needed for specific tables)
-- For demonstration, applying a basic "access only own company" policy to most tables.

CREATE OR REPLACE FUNCTION apply_tenant_policies()
RETURNS VOID AS $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT IN ('plans', 'companies', 'profiles', 'system_updates', 'system_settings', 'email_settings')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON public.%I', t);
        
        -- Apenas criar política se a tabela possuir a coluna company_id
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = t 
              AND column_name = 'company_id'
        ) THEN
            EXECUTE format('CREATE POLICY tenant_isolation_policy ON public.%I 
                            USING (company_id = public.get_user_company_id() OR EXISTS (
                                SELECT 1 FROM public.profiles 
                                WHERE id = auth.uid() AND is_admin = TRUE
                            )) 
                            WITH CHECK (company_id = public.get_user_company_id() OR EXISTS (
                                SELECT 1 FROM public.profiles 
                                WHERE id = auth.uid() AND is_admin = TRUE
                            ))', t);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT apply_tenant_policies();

-- SPECIAL POLICIES FOR CORE TABLES

-- PROFILES: Users can view everyone in their company, but only update themselves.
DROP POLICY IF EXISTS profile_view_policy ON public.profiles;
CREATE POLICY profile_view_policy ON public.profiles FOR SELECT USING (company_id = public.get_user_company_id() OR public.is_super_admin());

DROP POLICY IF EXISTS profile_update_policy ON public.profiles;
CREATE POLICY profile_update_policy ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_super_admin());

DROP POLICY IF EXISTS profile_admin_manage ON public.profiles;
CREATE POLICY profile_admin_manage ON public.profiles FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- COMPANIES: Admins can view/edit their own company.
DROP POLICY IF EXISTS company_view_policy ON public.companies;
CREATE POLICY company_view_policy ON public.companies FOR SELECT USING (id = public.get_user_company_id() OR public.is_super_admin());

DROP POLICY IF EXISTS company_all_policy ON public.companies;
CREATE POLICY company_all_policy ON public.companies FOR ALL USING (id = public.get_user_company_id() OR public.is_super_admin()) WITH CHECK (id = public.get_user_company_id() OR public.is_super_admin());

-- EMAIL SETTINGS: Secure RLS policies
DROP POLICY IF EXISTS tenant_isolation_policy ON public.email_settings;
DROP POLICY IF EXISTS email_settings_select_policy ON public.email_settings;
DROP POLICY IF EXISTS email_settings_all_policy ON public.email_settings;

CREATE POLICY email_settings_select_policy ON public.email_settings
FOR SELECT
USING (
    user_id = auth.uid()
    OR public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND (
            (email_permissions->>'can_view_all_accounts')::boolean = TRUE
            AND company_id = email_settings.company_id
        )
    )
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND COALESCE(email_permissions->'allowed_accounts', '[]'::jsonb) ? email_settings.id::text
    )
);

CREATE POLICY email_settings_all_policy ON public.email_settings
FOR ALL
USING (
    user_id = auth.uid()
    OR public.is_super_admin()
)
WITH CHECK (
    user_id = auth.uid()
    OR public.is_super_admin()
);

-- Drop UNIQUE constraint on user_id in email_settings to support multiple accounts
ALTER TABLE public.email_settings DROP CONSTRAINT IF EXISTS email_settings_user_id_key;

--------------------------------------------------------------------------------
-- 10. RPC FUNCTIONS
--------------------------------------------------------------------------------

-- Increment Poll Option Votes
CREATE OR REPLACE FUNCTION increment_poll_option_votes(option_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.poll_options
    SET votes = votes + 1
    WHERE id = option_id;
END;
$$ LANGUAGE plpgsql;

--------------------------------------------------------------------------------
-- 11. TRIGGERS
--------------------------------------------------------------------------------

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('plans', 'companies', 'profiles', 'system_settings', 'whatsapp_settings', 'email_settings')) LOOP
        EXECUTE format('CREATE OR REPLACE TRIGGER tr_handle_updated_at_%I 
                        BEFORE UPDATE ON public.%I 
                        FOR EACH ROW EXECUTE FUNCTION handle_updated_at()', r.tablename, r.tablename);
    END LOOP;
END $$;

-- SCRIPT COMPLETE
