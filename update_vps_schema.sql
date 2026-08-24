-- SCRIPT DE ATUALIZAÇÃO DE SCHEMA (VPS)
-- Objetivo: Criar tabelas ausentes que estão causando erros 406 (Polls, etc.) e outras funcionalidades (SaaS Dashboard, KB)
-- Execute este script no VPS: cat update_vps_schema.sql | docker exec -i supabase-db psql -U postgres

BEGIN;

-- 1. TABELAS DE ENQUETES (POLLS)
CREATE TABLE IF NOT EXISTS public.polls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    text TEXT NOT NULL, -- Alguns componentes usam 'text', outros 'option_text'. O código CompanyPoll usa 'text' ou 'option_text'. Vamos padronizar em 'text' e criar alias se precisar, mas o código já trata ambos.
    votes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE, -- Adicionado para facilitar RLS por empresa
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(poll_id, user_id)
);

-- 2. TABELAS DE DASHBOARD E SAAS (Manual Videos, System Updates)
CREATE TABLE IF NOT EXISTS public.manual_videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    thumbnail TEXT,
    duration TEXT,
    category TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version TEXT NOT NULL,
    description TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TABELAS SUPLEMENTARES (Services, Security Alerts, KB)
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'operational',
    uptime TEXT DEFAULT '99%',
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.security_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    level TEXT NOT NULL DEFAULT 'info',
    date TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kb_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT,
    content TEXT,
    views INTEGER DEFAULT 0,
    media_url TEXT,
    media_type TEXT, -- 'image' or 'video'
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.form_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    form_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pendente',
    submitted_at TIMESTAMPTZ DEFAULT now(),
    start_date DATE,
    end_date DATE,
    reason TEXT,
    sector_manager TEXT,
    employee_manager TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. HABILITAR RLS
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICAS RLS (Simplificadas para garantir funcionamento imediato)

-- Polls
DROP POLICY IF EXISTS "Polls View" ON public.polls;
CREATE POLICY "Polls View" ON public.polls FOR SELECT USING (true); -- Permite ver enquetes (filtro feito no front por company_id)
DROP POLICY IF EXISTS "Polls Manage" ON public.polls;
CREATE POLICY "Polls Manage" ON public.polls FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin') OR 
    (SELECT is_company_admin FROM public.profiles WHERE id = auth.uid()) = true
);

-- Poll Options
DROP POLICY IF EXISTS "Poll Options View" ON public.poll_options;
CREATE POLICY "Poll Options View" ON public.poll_options FOR SELECT USING (true);
DROP POLICY IF EXISTS "Poll Options Manage" ON public.poll_options;
CREATE POLICY "Poll Options Manage" ON public.poll_options FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin') OR 
    (SELECT is_company_admin FROM public.profiles WHERE id = auth.uid()) = true
);

-- Poll Votes
DROP POLICY IF EXISTS "Poll Votes View" ON public.poll_votes;
CREATE POLICY "Poll Votes View" ON public.poll_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Poll Votes Insert" ON public.poll_votes;
CREATE POLICY "Poll Votes Insert" ON public.poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- System Updates & Manual Videos (Leitura Pública para autenticados, Escrita apenas Super Admin)
DROP POLICY IF EXISTS "System Updates View" ON public.system_updates;
CREATE POLICY "System Updates View" ON public.system_updates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Manual Videos View" ON public.manual_videos;
CREATE POLICY "Manual Videos View" ON public.manual_videos FOR SELECT TO authenticated USING (true);

-- KB Articles
DROP POLICY IF EXISTS "KB View" ON public.kb_articles;
CREATE POLICY "KB View" ON public.kb_articles FOR SELECT USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
DROP POLICY IF EXISTS "KB Manage" ON public.kb_articles;
CREATE POLICY "KB Manage" ON public.kb_articles FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin') OR 
    (SELECT is_company_admin FROM public.profiles WHERE id = auth.uid()) = true
);

-- Services & Alerts
DROP POLICY IF EXISTS "Services View" ON public.services;
CREATE POLICY "Services View" ON public.services FOR SELECT USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
DROP POLICY IF EXISTS "Alerts View" ON public.security_alerts;
CREATE POLICY "Alerts View" ON public.security_alerts FOR SELECT USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

COMMIT;
