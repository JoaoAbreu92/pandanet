-- =========================================================================
-- PandaNet - MIGRATION: PROJETOS E ASSINATURA DE USUÁRIOS
-- Cria as tabelas de projetos (estilo Kanban Odoo) e atualiza a função
-- RPC update_user_profile para a assinatura esperada pelo frontend.
-- =========================================================================

BEGIN;

-- ==========================================
-- 1. ESTRUTURA DE PERFIS (PROFILES)
-- ==========================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS reports_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sector_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_manager BOOLEAN DEFAULT FALSE;

-- ==========================================
-- 2. RECRIAR FUNÇÃO UPDATE_USER_PROFILE
-- ==========================================
-- Remove todas as versões anteriores da função para evitar conflitos de assinatura
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT oid::regprocedure::text as signature 
        FROM pg_proc 
        WHERE proname = 'update_user_profile'
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.signature || ' CASCADE';
    END LOOP;
END $$;

-- Cria a versão com a assinatura exata de 27 parâmetros esperada pelo frontend
CREATE OR REPLACE FUNCTION public.update_user_profile(
    p_user_id UUID,
    p_full_name TEXT,
    p_role TEXT,
    p_team TEXT,
    p_department_id UUID DEFAULT NULL,
    p_is_admin BOOLEAN DEFAULT FALSE,
    p_is_company_admin BOOLEAN DEFAULT FALSE,
    p_permissions JSONB DEFAULT '{}'::jsonb,
    p_avatar_url TEXT DEFAULT NULL,
    p_rg TEXT DEFAULT NULL,
    p_cpf TEXT DEFAULT NULL,
    p_emergency_contact_name TEXT DEFAULT NULL,
    p_emergency_contact_phone TEXT DEFAULT NULL,
    p_health_insurance TEXT DEFAULT NULL,
    p_blood_type TEXT DEFAULT NULL,
    p_marital_status TEXT DEFAULT NULL,
    p_education_level TEXT DEFAULT NULL,
    p_can_nudge BOOLEAN DEFAULT TRUE,
    p_nudge_cooldown INTEGER DEFAULT 30,
    p_is_whatsapp_agent BOOLEAN DEFAULT FALSE,
    p_whatspanda_permissions JSONB DEFAULT '{}'::jsonb,
    p_email_permissions JSONB DEFAULT '{}'::jsonb,
    p_reports_to UUID DEFAULT NULL,
    p_sector_manager_id UUID DEFAULT NULL,
    p_is_manager BOOLEAN DEFAULT FALSE,
    p_clear_reports_to BOOLEAN DEFAULT FALSE,
    p_clear_sector_manager BOOLEAN DEFAULT FALSE
)
RETURNS void AS $$
BEGIN
    UPDATE public.profiles
    SET
        full_name = p_full_name,
        role = p_role,
        team = p_team,
        department_id = p_department_id,
        is_admin = p_is_admin,
        is_company_admin = p_is_company_admin,
        permissions = p_permissions,
        avatar_url = p_avatar_url,
        rg = p_rg,
        cpf = p_cpf,
        emergency_contact_name = p_emergency_contact_name,
        emergency_contact_phone = p_emergency_contact_phone,
        health_insurance = p_health_insurance,
        blood_type = p_blood_type,
        marital_status = p_marital_status,
        education_level = p_education_level,
        can_nudge = p_can_nudge,
        nudge_cooldown = p_nudge_cooldown,
        is_whatsapp_agent = p_is_whatsapp_agent,
        whatspanda_permissions = p_whatspanda_permissions,
        email_permissions = p_email_permissions,
        is_manager = p_is_manager,
        reports_to = CASE WHEN p_clear_reports_to THEN NULL ELSE COALESCE(p_reports_to, reports_to) END,
        sector_manager_id = CASE WHEN p_clear_sector_manager THEN NULL ELSE COALESCE(p_sector_manager_id, sector_manager_id) END,
        updated_at = now()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Concede execução para usuários autenticados e service_role
GRANT EXECUTE ON FUNCTION public.update_user_profile(
    UUID, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN, JSONB, JSONB, UUID, UUID, BOOLEAN, BOOLEAN, BOOLEAN
) TO authenticated, service_role;


-- ==========================================
-- 3. CRIAR TABELA: PROJECTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#10B981',
    manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ==========================================
-- 4. CRIAR TABELA: PROJECT_STAGES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.project_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position INTEGER NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ==========================================
-- 5. CRIAR TABELA: PROJECT_TASKS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.project_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES public.project_stages(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'Média',
    due_date TIMESTAMP WITH TIME ZONE,
    start_date TIMESTAMP WITH TIME ZONE,
    cover_url TEXT,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT '{}'::text[],
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ==========================================
-- 6. CRIAR TABELA: PROJECT_SUBTASKS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.project_subtasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES public.project_tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ==========================================
-- 7. CRIAR TABELA: PROJECT_TIMESHEETS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.project_timesheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES public.project_tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    hours NUMERIC NOT NULL,
    description TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ==========================================
-- 8. CRIAR TABELA: PROJECT_TASK_COMMENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.project_task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES public.project_tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ==========================================
-- 9. PERMISSÕES E RLS
-- ==========================================
-- Habilitar RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_task_comments ENABLE ROW LEVEL SECURITY;

-- Criar Políticas de RLS simplificadas por Company ID (equivalente ao resto da aplicação)
-- Projetos
DROP POLICY IF EXISTS "Projects access policy" ON public.projects;
CREATE POLICY "Projects access policy" ON public.projects 
    FOR ALL TO authenticated 
    USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Estágios
DROP POLICY IF EXISTS "Stages access policy" ON public.project_stages;
CREATE POLICY "Stages access policy" ON public.project_stages 
    FOR ALL TO authenticated 
    USING (project_id IN (SELECT id FROM public.projects));

-- Tarefas
DROP POLICY IF EXISTS "Tasks access policy" ON public.project_tasks;
CREATE POLICY "Tasks access policy" ON public.project_tasks 
    FOR ALL TO authenticated 
    USING (project_id IN (SELECT id FROM public.projects));

-- Subtarefas
DROP POLICY IF EXISTS "Subtasks access policy" ON public.project_subtasks;
CREATE POLICY "Subtasks access policy" ON public.project_subtasks 
    FOR ALL TO authenticated 
    USING (task_id IN (SELECT id FROM public.project_tasks));

-- Apontamentos de Horas
DROP POLICY IF EXISTS "Timesheets access policy" ON public.project_timesheets;
CREATE POLICY "Timesheets access policy" ON public.project_timesheets 
    FOR ALL TO authenticated 
    USING (task_id IN (SELECT id FROM public.project_tasks));

-- Comentários
DROP POLICY IF EXISTS "Comments access policy" ON public.project_task_comments;
CREATE POLICY "Comments access policy" ON public.project_task_comments 
    FOR ALL TO authenticated 
    USING (task_id IN (SELECT id FROM public.project_tasks));

-- Conceder direitos gerais
GRANT ALL ON TABLE public.projects TO authenticated, service_role;
GRANT ALL ON TABLE public.project_stages TO authenticated, service_role;
GRANT ALL ON TABLE public.project_tasks TO authenticated, service_role;
GRANT ALL ON TABLE public.project_subtasks TO authenticated, service_role;
GRANT ALL ON TABLE public.project_timesheets TO authenticated, service_role;
GRANT ALL ON TABLE public.project_task_comments TO authenticated, service_role;

-- ==========================================
-- 10. RECARREGAR SCHEMA CACHE
-- ==========================================
NOTIFY pgrst, 'reload schema';

COMMIT;
