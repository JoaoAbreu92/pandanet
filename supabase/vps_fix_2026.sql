-- ==========================================
-- VPS DATABASE FIX - 2026-03-10
-- ==========================================
-- This script fixes missing migrations on the self-hosted VPS instance.
-- It ensures ai_messages support agent_id and user management functions work correctly.

-- 1. AI ASSISTANT FIXES
ALTER TABLE public.ai_messages ADD COLUMN IF NOT EXISTS agent_id UUID;

-- Ensure ai_agents exists (basic structure)
CREATE TABLE IF NOT EXISTS public.ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    name TEXT NOT NULL,
    system_prompt TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key if not present
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ai_messages_agent_id_fkey') THEN
        ALTER TABLE public.ai_messages ADD CONSTRAINT ai_messages_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id);
    END IF;
END $$;

-- 2. USER MANAGEMENT RPC FUNCTIONS

-- Function to securely create a user in auth.users and public.profiles on VPS
-- This function uses pgcrypto for password encryption (Standard in Supabase/Docker)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Dropar assinaturas antigas das funções para evitar erro de propriedade e acúmulo de sobrecargas
DROP FUNCTION IF EXISTS public.delete_user_admin(UUID);
DROP FUNCTION IF EXISTS public.create_user_admin(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_user_admin(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, UUID, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN, JSONB, JSONB);
DROP FUNCTION IF EXISTS public.create_user_admin(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, UUID, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN, JSONB, JSONB, DATE, UUID, UUID);
DROP FUNCTION IF EXISTS public.create_user_admin(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, UUID, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN, JSONB, JSONB, DATE, UUID, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.update_user_profile(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.update_user_profile(UUID, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN, JSONB, JSONB, UUID, UUID);
DROP FUNCTION IF EXISTS public.update_user_profile(UUID, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN, JSONB, JSONB, UUID, UUID, BOOLEAN, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION public.create_user_admin(
    p_email TEXT,
    p_password TEXT DEFAULT 'PandaNet123!',
    p_full_name TEXT DEFAULT 'Novo Usuário',
    p_role TEXT DEFAULT 'Colaborador',
    p_team TEXT DEFAULT 'Geral',
    p_company_id UUID DEFAULT NULL,
    p_is_admin BOOLEAN DEFAULT FALSE,
    p_is_company_admin BOOLEAN DEFAULT FALSE,
    p_permissions JSONB DEFAULT '{}'::jsonb,
    p_avatar_url TEXT DEFAULT NULL,
    p_department_id UUID DEFAULT NULL,
    p_rg TEXT DEFAULT NULL,
    p_cpf TEXT DEFAULT NULL,
    p_can_nudge BOOLEAN DEFAULT TRUE,
    p_nudge_cooldown INTEGER DEFAULT 30,
    p_is_whatsapp_agent BOOLEAN DEFAULT FALSE,
    p_whatspanda_permissions JSONB DEFAULT '{}'::jsonb,
    p_email_permissions JSONB DEFAULT '{}'::jsonb,
    p_join_date DATE DEFAULT NULL,
    p_reports_to UUID DEFAULT NULL,
    p_sector_manager_id UUID DEFAULT NULL,
    p_is_manager BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_new_id UUID;
    v_caller_company_id UUID;
    v_caller_is_super BOOLEAN;
    v_caller_is_admin BOOLEAN;
    v_encrypted_pw TEXT;
BEGIN
    SELECT
        company_id,
        (role = 'Super Admin'),
        (is_company_admin OR is_admin OR role = ANY(ARRAY['admin', 'Company Admin', 'Gestor', 'Administrador']))
    INTO v_caller_company_id, v_caller_is_super, v_caller_is_admin
    FROM public.profiles
    WHERE id = auth.uid();

    IF NOT (v_caller_is_super OR (v_caller_is_admin AND (p_company_id IS NULL OR v_caller_company_id = p_company_id))) THEN
        RAISE EXCEPTION 'Permissão negada.';
    END IF;

    IF NOT v_caller_is_super THEN
        p_company_id := v_caller_company_id;
    END IF;

    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
        RAISE EXCEPTION 'Email % já cadastrado.', p_email;
    END IF;

    v_new_id := gen_random_uuid();
    v_encrypted_pw := extensions.crypt(COALESCE(p_password, 'PandaNet123!'), extensions.gen_salt('bf'));

    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, role, aud)
    VALUES (v_new_id, '00000000-0000-0000-0000-000000000000', p_email, v_encrypted_pw, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', p_full_name), FALSE, NOW(), NOW(), 'authenticated', 'authenticated');

    INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id)
    VALUES (gen_random_uuid(), v_new_id, jsonb_build_object('sub', v_new_id::text, 'email', p_email), 'email', NOW(), NOW(), NOW(), v_new_id::text);

    INSERT INTO public.profiles (
        id, email, full_name, role, team, company_id, is_admin, is_company_admin, permissions, avatar_url, department_id, rg, cpf, status, can_nudge, nudge_cooldown, is_whatsapp_agent, whatspanda_permissions, email_permissions, join_date, reports_to, sector_manager_id, is_manager
    ) VALUES (
        v_new_id, p_email, p_full_name, p_role, p_team, p_company_id, p_is_admin, p_is_company_admin, COALESCE(p_permissions, '{}'), p_avatar_url, p_department_id, p_rg, p_cpf, 'active', p_can_nudge, p_nudge_cooldown, p_is_whatsapp_agent, COALESCE(p_whatspanda_permissions, '{}'), COALESCE(p_email_permissions, '{}'), COALESCE(p_join_date, CURRENT_DATE), p_reports_to, p_sector_manager_id, p_is_manager
    );

    RETURN v_new_id;
END;
$$;

-- Function to update user profiles (Bypass RLS for Admins)
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
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        reports_to = CASE WHEN p_clear_reports_to THEN NULL ELSE COALESCE(p_reports_to, reports_to) END,
        sector_manager_id = CASE WHEN p_clear_sector_manager THEN NULL ELSE COALESCE(p_sector_manager_id, sector_manager_id) END,
        is_manager = p_is_manager,
        updated_at = now()
    WHERE id = p_user_id;
END;
$$;

-- Function to securely delete a user (Auth + Profile) on VPS
CREATE OR REPLACE FUNCTION public.delete_user_admin(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Limpar referências em documentos e solicitações de RH (setar NULL)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hr_documents') THEN
        UPDATE public.hr_documents SET created_by = NULL WHERE created_by = target_user_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hr_payslips') THEN
        UPDATE public.hr_payslips SET created_by = NULL WHERE created_by = target_user_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hr_vacation_requests') THEN
        UPDATE public.hr_vacation_requests SET reviewed_by = NULL WHERE reviewed_by = target_user_id;
    END IF;

    -- 2. Deletar dependências diretas de comunicação e social
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nudges') THEN
        DELETE FROM public.nudges WHERE sender_id = target_user_id OR receiver_id = target_user_id;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages') THEN
        UPDATE public.messages SET reply_to = NULL WHERE reply_to IN (SELECT id FROM public.messages WHERE sender_id = target_user_id);
        DELETE FROM public.messages WHERE sender_id = target_user_id;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conversation_participants') THEN
        DELETE FROM public.conversation_participants WHERE user_id = target_user_id;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recognitions') THEN
        DELETE FROM public.recognitions WHERE from_id = target_user_id OR to_id = target_user_id;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'post_reactions') THEN
        DELETE FROM public.post_reactions WHERE user_id = target_user_id;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'comments') THEN
        DELETE FROM public.comments WHERE author_id = target_user_id;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'posts') THEN
        DELETE FROM public.posts WHERE author_id = target_user_id;
    END IF;

    -- 3. Deletar dependências de gamificação e outros
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_badges') THEN
        DELETE FROM public.user_badges WHERE user_id = target_user_id OR awarded_by = target_user_id;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'department_users') THEN
        DELETE FROM public.department_users WHERE user_id = target_user_id;
    END IF;

    -- 4. Limpar chamados e suporte TI
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tickets') THEN
        UPDATE public.tickets SET requester_id = NULL WHERE requester_id = target_user_id;
        UPDATE public.tickets SET assigned_user_id = NULL WHERE assigned_user_id = target_user_id;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ticket_comments') THEN
        UPDATE public.ticket_comments SET author_id = NULL WHERE author_id = target_user_id;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ti_requests') THEN
        UPDATE public.ti_requests SET requester_id = NULL WHERE requester_id = target_user_id;
        UPDATE public.ti_requests SET assigned_user_id = NULL WHERE assigned_user_id = target_user_id;
    END IF;

    -- 5. Limpar marketplace
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'marketplace_items') THEN
        DELETE FROM public.marketplace_items WHERE listed_by = target_user_id;
        UPDATE public.marketplace_items SET reserved_by = NULL WHERE reserved_by = target_user_id;
    END IF;

    -- 6. Limpar WhatsApp settings e mensagens
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_conversations') THEN
        UPDATE public.whatsapp_conversations SET assigned_to = NULL WHERE assigned_to = target_user_id;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_messages') THEN
        UPDATE public.whatsapp_messages SET sent_by = NULL WHERE sent_by = target_user_id;
    END IF;

    -- 7. Limpar eventos e agendas
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'calendar_events') THEN
        UPDATE public.calendar_events SET creator_id = NULL WHERE creator_id = target_user_id;
    END IF;

    -- 8. Limpar e-mails
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_settings') THEN
        DELETE FROM public.email_settings WHERE user_id = target_user_id;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'emails') THEN
        DELETE FROM public.emails WHERE user_id = target_user_id;
    END IF;

    -- 9. Limpar formulários
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'form_submissions') THEN
        UPDATE public.form_submissions SET requester_id = NULL WHERE requester_id = target_user_id;
    END IF;

    -- 10. Limpar tarefas (tasks)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
        UPDATE public.tasks SET assigned_to = NULL WHERE assigned_to = target_user_id;
        UPDATE public.tasks SET created_by = NULL WHERE created_by = target_user_id;
    END IF;

    -- 11. Limpar notas de contatos (contact_notes)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contact_notes') THEN
        DELETE FROM public.contact_notes WHERE user_id = target_user_id;
    END IF;

    -- 12. Limpar tags de conversação (conversation_tags)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conversation_tags') THEN
        DELETE FROM public.conversation_tags WHERE user_id = target_user_id;
        UPDATE public.conversation_tags SET created_by = NULL WHERE created_by = target_user_id;
    END IF;

    -- 13. Deletar do perfil público
    DELETE FROM public.profiles WHERE id = target_user_id;

    -- 14. Deletar do auth.identities
    DELETE FROM auth.identities WHERE user_id = target_user_id;

    -- 15. Deletar do auth.users
    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- 3. RLS FIXES
-- Clean up all existing policies on public.profiles to prevent recursion
DROP POLICY IF EXISTS "Admin manage all profiles in company" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in same company" ON public.profiles;
DROP POLICY IF EXISTS "Manage Profile Insertion" ON public.profiles;
DROP POLICY IF EXISTS "Manage Profile Updates" ON public.profiles;
DROP POLICY IF EXISTS "Manage Profile Deletion" ON public.profiles;
DROP POLICY IF EXISTS "Super Admin can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Super Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "View Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Update Own Profile" ON public.profiles;
DROP POLICY IF EXISTS "Insert Own Profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;

-- Create clean, recursion-free policies
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT TO authenticated
USING (
    company_id = public.get_user_company_id()
    OR public.is_super_admin()
);

CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
    public.is_company_admin(company_id)
    OR auth.uid() = id
);

CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE TO authenticated
USING (
    public.is_company_admin(company_id)
    OR auth.uid() = id
)
WITH CHECK (
    public.is_company_admin(company_id)
    OR auth.uid() = id
);

CREATE POLICY "profiles_delete_policy" ON public.profiles
FOR DELETE TO authenticated
USING (
    public.is_company_admin(company_id)
);

-- Ensure execute permissions
GRANT EXECUTE ON FUNCTION public.update_user_profile(UUID, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN, JSONB, JSONB, UUID, UUID, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_user_admin(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, UUID, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN, JSONB, JSONB, DATE, UUID, UUID, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_user_admin(UUID) TO authenticated, service_role;

-- 4. VIEW DE AGENDAMENTOS PARA ACESSO PÚBLICO (CAL.COM CLONE)
-- Permite que usuários não autenticados vejam apenas data, horário e status dos agendamentos para fins de disponibilidade
CREATE OR REPLACE VIEW public.scheduling_booked_slots AS
SELECT id, event_type_id, booking_date, booking_time, status
FROM public.scheduling_bookings;

ALTER VIEW public.scheduling_booked_slots OWNER TO postgres;
GRANT SELECT ON public.scheduling_booked_slots TO anon, authenticated;

-- 5. TABELA DE NOTAS PESSOAIS (BLOCO DE NOTAS)
CREATE TABLE IF NOT EXISTS public.personal_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'Nova Nota',
    content TEXT NOT NULL DEFAULT '',
    category VARCHAR(100) NOT NULL DEFAULT 'Geral',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.personal_notes ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Users can manage their own personal notes" ON public.personal_notes;
CREATE POLICY "Users can manage their own personal notes" 
ON public.personal_notes 
FOR ALL 
USING (
    auth.uid() = user_id 
    OR public.is_super_admin()
)
WITH CHECK (
    auth.uid() = user_id 
    OR public.is_super_admin()
);

-- 3. PROJECT TASK-SPECIFIC CHECKLIST ITEMS SUPPORT
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS checklist_items JSONB DEFAULT '{}'::jsonb;

-- Force Schema Cache Reload (Standard trick)
NOTIFY pgrst, 'reload schema';

-- ==========================================
-- 6. RESET PASSWORD FIX (GEN_SALT SCHEMA BUGS)
-- ==========================================
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(p_user_id uuid, p_new_password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
    v_caller_role text;
    v_caller_is_company_admin boolean;
    v_caller_company_id uuid;
    v_target_company_id uuid;
BEGIN
    -- Get caller info
    SELECT role, is_company_admin, company_id 
    INTO v_caller_role, v_caller_is_company_admin, v_caller_company_id
    FROM public.profiles WHERE id = auth.uid();

    -- Get target user info
    SELECT company_id INTO v_target_company_id
    FROM public.profiles WHERE id = p_user_id;

    -- Authorization Check: Super Admin OR (Company Admin of the same company)
    IF v_caller_role != 'Super Admin' AND NOT (v_caller_is_company_admin AND v_caller_company_id = v_target_company_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
    END IF;

    -- Update the password in auth.users using explicit extensions schema prefix
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
        updated_at = now()
    WHERE id = p_user_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- ==========================================
-- 7. CHAT GROUP SYNC RLS POLICIES FOR TEAMS
-- ==========================================
-- 7.1 Helper function to check company admin status
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
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

CREATE OR REPLACE FUNCTION public.is_admin_in_profile()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR is_company_admin = true OR role = 'Super Admin' OR role = 'admin' OR role = 'Company Admin')
  ) OR (
    auth.jwt() ->> 'email' = 'ti@grupopixel.com.br'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(comp_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF public.is_super_admin() OR auth.jwt() ->> 'email' = 'ti@grupopixel.com.br' THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND company_id = comp_id
    AND (is_admin = true OR is_company_admin = true OR role = 'admin' OR role = 'Company Admin')
  );
END;
$$;

-- 7.2 Clear legacy policies
DROP POLICY IF EXISTS "Company admins can view conversations" ON public.conversations;
DROP POLICY IF EXISTS "Company admins can update conversations" ON public.conversations;
DROP POLICY IF EXISTS "Company admins can delete conversations" ON public.conversations;
DROP POLICY IF EXISTS "Creators can delete conversations" ON public.conversations;

DROP POLICY IF EXISTS "Company admins can view participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Company admins can delete participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Conversation creators can view participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Conversation creators can delete participants" ON public.conversation_participants;

-- 7.3 Create new policies for conversations
CREATE POLICY "Company admins can view conversations" 
ON public.conversations 
FOR SELECT 
TO authenticated 
USING (
  is_company_admin(company_id)
);

CREATE POLICY "Company admins can update conversations" 
ON public.conversations 
FOR UPDATE 
TO authenticated 
USING (
  is_company_admin(company_id)
);

CREATE POLICY "Company admins can delete conversations" 
ON public.conversations 
FOR DELETE 
TO authenticated 
USING (
  is_company_admin(company_id)
);

CREATE POLICY "Creators can delete conversations" 
ON public.conversations 
FOR DELETE 
TO authenticated 
USING (
  created_by = auth.uid()
);

-- 7.4 Create new policies for conversation_participants
CREATE POLICY "Company admins can view participants" 
ON public.conversation_participants 
FOR SELECT 
TO authenticated 
USING (
  is_company_admin(company_id)
);

CREATE POLICY "Company admins can delete participants" 
ON public.conversation_participants 
FOR DELETE 
TO authenticated 
USING (
  is_company_admin(company_id)
);

CREATE POLICY "Conversation creators can view participants" 
ON public.conversation_participants 
FOR SELECT 
TO authenticated 
USING (
  conversation_id IN (SELECT id FROM public.conversations WHERE created_by = auth.uid())
);

CREATE POLICY "Conversation creators can delete participants" 
ON public.conversation_participants 
FOR DELETE 
TO authenticated 
USING (
  conversation_id IN (SELECT id FROM public.conversations WHERE created_by = auth.uid())
);

-- ==========================================
-- UPDATE 11/06/2026: VAGAS, IMAGENS E HIERARQUIA
-- ==========================================

-- 1. Alterações na tabela jobs (Vagas Internas)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS description_image TEXT;

-- Remover a check constraint de tipo na tabela jobs para suportar digitação manual livre
DO $$
DECLARE
    constraint_name_var text;
BEGIN
    SELECT tc.constraint_name
    INTO constraint_name_var
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'jobs' AND ccu.column_name = 'type' AND tc.constraint_type = 'CHECK';

    IF constraint_name_var IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.jobs DROP CONSTRAINT ' || constraint_name_var;
    END IF;
END $$;

-- 2. Atualizar apply_tenant_policies para dar bypass nos Super Admins
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN (SELECT company_id FROM public.profiles WHERE id = auth.uid());
END;
$$;

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
                            USING (company_id = public.get_user_company_id() OR public.is_admin_in_profile()) 
                            WITH CHECK (company_id = public.get_user_company_id() OR public.is_admin_in_profile())', t);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Criar tabela policies
CREATE TABLE IF NOT EXISTS public.policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

-- Re-aplicar políticas em todas as tabelas
SELECT apply_tenant_policies();

-- 3. Criar RPC update_user_hierarchy para atualizar hierarquia do organograma de forma limpa e leve
CREATE OR REPLACE FUNCTION public.update_user_hierarchy(
    p_user_id UUID,
    p_reports_to UUID DEFAULT NULL,
    p_sector_manager_id UUID DEFAULT NULL,
    p_is_manager BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles
    SET
        reports_to = p_reports_to,
        sector_manager_id = p_sector_manager_id,
        is_manager = p_is_manager,
        updated_at = now()
    WHERE id = p_user_id;
END;
$$;

-- Conceder permissões para a nova função
GRANT EXECUTE ON FUNCTION public.update_user_hierarchy(UUID, UUID, UUID, BOOLEAN) TO authenticated, service_role;

-- 4. Definir políticas de RLS seguras para email_settings
DROP POLICY IF EXISTS tenant_isolation_policy ON public.email_settings;
DROP POLICY IF EXISTS email_settings_select_policy ON public.email_settings;
DROP POLICY IF EXISTS email_settings_write_policy ON public.email_settings;
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

-- Final Force Schema Cache Reload
NOTIFY pgrst, 'reload schema';

-- 6. Drop UNIQUE constraint on email_settings.user_id to support multiple email accounts per user
ALTER TABLE public.email_settings DROP CONSTRAINT IF EXISTS email_settings_user_id_key;

-- 7. CHAT MESSAGE & CONVERSATION UPDATE POLICIES
DROP POLICY IF EXISTS "Users can update messages" ON public.messages;
CREATE POLICY "Users can update messages" ON public.messages 
FOR UPDATE TO authenticated 
USING (conversation_id IN (SELECT get_safe_conversation_ids()))
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update conversations" ON public.conversations;
CREATE POLICY "Users can update conversations" ON public.conversations 
FOR UPDATE TO authenticated 
USING (id IN (SELECT get_safe_conversation_ids()))
WITH CHECK (true);

-- 8. REOPEN INTERNAL CONVERSATIONS (SAME COMPANY) THAT ARE CLOSED
UPDATE public.conversations SET is_closed = false 
WHERE id IN (
  SELECT c.id FROM public.conversations c 
  JOIN public.conversation_participants cp1 ON c.id = cp1.conversation_id 
  JOIN public.conversation_participants cp2 ON c.id = cp2.conversation_id 
  JOIN public.profiles p1 ON cp1.user_id = p1.id 
  JOIN public.profiles p2 ON cp2.user_id = p2.id 
  WHERE c.is_group = false 
    AND p1.company_id = p2.company_id 
    AND p1.id != p2.id
);

-- 9. SCHEDULING SYSTEM COLUMNS & TABLES
ALTER TABLE public.scheduling_bookings ADD COLUMN IF NOT EXISTS guest_cpf TEXT;

CREATE TABLE IF NOT EXISTS public.scheduling_settings (
    company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
    company_name TEXT,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.scheduling_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso completo de configurações por empresa" ON public.scheduling_settings;
CREATE POLICY "Acesso completo de configurações por empresa" ON public.scheduling_settings
    FOR ALL USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) OR public.is_super_admin());

DROP POLICY IF EXISTS "Leitura pública de configurações por empresa" ON public.scheduling_settings;
CREATE POLICY "Leitura pública de configurações por empresa" ON public.scheduling_settings
    FOR SELECT USING (true);

ALTER TABLE public.scheduling_event_types ADD COLUMN IF NOT EXISTS duration_unit TEXT DEFAULT 'minutes';
ALTER TABLE public.scheduling_event_types ADD COLUMN IF NOT EXISTS disable_time_slots BOOLEAN DEFAULT FALSE;
ALTER TABLE public.scheduling_event_types ADD COLUMN IF NOT EXISTS has_capacity_limit BOOLEAN DEFAULT FALSE;
ALTER TABLE public.scheduling_event_types ADD COLUMN IF NOT EXISTS capacity_limit INTEGER DEFAULT 0;
ALTER TABLE public.scheduling_event_types ADD COLUMN IF NOT EXISTS show_capacity_to_guest BOOLEAN DEFAULT TRUE;
ALTER TABLE public.scheduling_event_types ADD COLUMN IF NOT EXISTS has_lunch_break BOOLEAN DEFAULT FALSE;
ALTER TABLE public.scheduling_event_types ADD COLUMN IF NOT EXISTS lunch_start_time TEXT DEFAULT '12:00';
ALTER TABLE public.scheduling_event_types ADD COLUMN IF NOT EXISTS lunch_end_time TEXT DEFAULT '13:00';

-- 10. WHATSAPP MESSAGES SENDER COLUMNS
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS sender_phone TEXT;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
GRANT ALL ON TABLE public.whatsapp_messages TO anon, authenticated, service_role;

-- 11. WHATSAPP CONVERSATIONS QUEUE_ID RELATIONSHIP
DO $$
BEGIN
    -- Check if column exists, if not create it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'whatsapp_conversations' AND column_name = 'queue_id') THEN
        ALTER TABLE public.whatsapp_conversations ADD COLUMN queue_id UUID;
    END IF;

    -- Add foreign key constraint if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'whatsapp_conversations' AND constraint_name = 'whatsapp_conversations_queue_id_fkey') THEN
        ALTER TABLE public.whatsapp_conversations ADD CONSTRAINT whatsapp_conversations_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES public.whatsapp_queues(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 12. WHATSAPP CONVERSATIONS RLS POLICIES (QUEUE-BASED)
-- Drop legacy department-based RLS policies
DROP POLICY IF EXISTS "Users see conversations from their department or assigned to them" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Users can view conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Users can insert conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Users can update conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.whatsapp_conversations;

-- Drop new policies to make script idempotent
DROP POLICY IF EXISTS "whatsapp_conversations_select_policy" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "whatsapp_conversations_insert_policy" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "whatsapp_conversations_update_policy" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "whatsapp_conversations_delete_policy" ON public.whatsapp_conversations;


-- Create queue-aware SELECT policy
CREATE POLICY "whatsapp_conversations_select_policy"
  ON public.whatsapp_conversations
  FOR SELECT
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (
      -- Admins and Super Admins see everything in their company
      (SELECT is_admin OR is_company_admin OR role = 'Super Admin' FROM public.profiles WHERE id = auth.uid())
      OR
      -- Assigned to the user
      assigned_to = auth.uid()
      OR
      -- Assigned to a queue the user has access to
      (
        queue_id IS NOT NULL 
        AND (SELECT COALESCE(whatspanda_permissions->'assigned_queues', '[]'::jsonb) FROM public.profiles WHERE id = auth.uid()) ? queue_id::text
      )
      OR
      -- Unassigned and no queue (global triage)
      (assigned_to IS NULL AND queue_id IS NULL)
    )
  );

-- Create INSERT policy
CREATE POLICY "whatsapp_conversations_insert_policy"
  ON public.whatsapp_conversations
  FOR INSERT
  WITH CHECK (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

-- Create UPDATE policy
CREATE POLICY "whatsapp_conversations_update_policy"
  ON public.whatsapp_conversations
  FOR UPDATE
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (
      -- Admins and Super Admins can update everything in their company
      (SELECT is_admin OR is_company_admin OR role = 'Super Admin' FROM public.profiles WHERE id = auth.uid())
      OR
      -- Assigned to the user
      assigned_to = auth.uid()
      OR
      -- Assigned to a queue the user has access to
      (
        queue_id IS NOT NULL 
        AND (SELECT COALESCE(whatspanda_permissions->'assigned_queues', '[]'::jsonb) FROM public.profiles WHERE id = auth.uid()) ? queue_id::text
      )
      OR
      -- Unassigned and no queue
      (assigned_to IS NULL AND queue_id IS NULL)
    )
  );

-- Create DELETE policy
CREATE POLICY "whatsapp_conversations_delete_policy"
  ON public.whatsapp_conversations
  FOR DELETE
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT is_admin OR is_company_admin OR role = 'Super Admin' FROM public.profiles WHERE id = auth.uid())
  );

-- 13. WHATSAPP SETTINGS PAIRING_CODE COLUMN
ALTER TABLE public.whatsapp_settings ADD COLUMN IF NOT EXISTS pairing_code TEXT;

-- 14. WHATSAPP SETTINGS & QUEUES TRANSFER AND HORARIOS COLUMNS
ALTER TABLE public.whatsapp_settings ADD COLUMN IF NOT EXISTS transfer_message_client TEXT DEFAULT 'Seu atendimento foi transferido para {target}. Por favor, aguarde.';
ALTER TABLE public.whatsapp_settings ADD COLUMN IF NOT EXISTS transfer_message_agent TEXT DEFAULT 'Atendimento transferido para {target} por {sender}.';
ALTER TABLE public.whatsapp_settings ADD COLUMN IF NOT EXISTS send_transfer_message_to_client BOOLEAN DEFAULT TRUE;

ALTER TABLE public.whatsapp_queues ADD COLUMN IF NOT EXISTS custom_hours BOOLEAN DEFAULT FALSE;
ALTER TABLE public.whatsapp_queues ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT NULL;
ALTER TABLE public.whatsapp_queues ADD COLUMN IF NOT EXISTS away_message TEXT DEFAULT NULL;

ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS last_away_message_at TIMESTAMPTZ DEFAULT NULL;

-- Final Force Schema Cache Reload
NOTIFY pgrst, 'reload schema';

-- ==========================================
-- 15. CHATBOT TABLES & POLICIES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.whatsapp_chatbot_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_chatbot_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID REFERENCES public.whatsapp_chatbot_flows(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    content JSONB DEFAULT '{}'::jsonb,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.whatsapp_chatbot_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_chatbot_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON public.whatsapp_chatbot_flows;
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.whatsapp_chatbot_flows;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.whatsapp_chatbot_nodes;
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.whatsapp_chatbot_nodes;

CREATE POLICY "tenant_isolation_policy" ON public.whatsapp_chatbot_flows
    FOR ALL TO authenticated
    USING (company_id = public.get_user_company_id() OR public.is_admin_in_profile())
    WITH CHECK (company_id = public.get_user_company_id() OR public.is_admin_in_profile());

CREATE POLICY "tenant_isolation_policy" ON public.whatsapp_chatbot_nodes
    FOR ALL TO authenticated
    USING (flow_id IN (SELECT id FROM public.whatsapp_chatbot_flows WHERE company_id = public.get_user_company_id() OR public.is_admin_in_profile()))
    WITH CHECK (flow_id IN (SELECT id FROM public.whatsapp_chatbot_flows WHERE company_id = public.get_user_company_id() OR public.is_admin_in_profile()));

-- Inicializar sort_order para nós existentes (usando id como tiebreaker pois não há created_at)
UPDATE public.whatsapp_chatbot_nodes n
SET sort_order = sub.row_number - 1
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY flow_id ORDER BY id ASC) AS row_number
    FROM public.whatsapp_chatbot_nodes
) sub
WHERE n.id = sub.id AND n.sort_order = 0;

-- Final Force Schema Cache Reload
NOTIFY pgrst, 'reload schema';

-- ==========================================
-- 16. STORAGE RLS POLICIES FOR UPLOADING FILES
-- ==========================================
-- Garante que RLS está habilitada na tabela storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas conflitantes
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Updates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Deletes" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;

-- Cria políticas universais permissivas para usuários autenticados da intranet
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (true);
CREATE POLICY "Authenticated Uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated Updates" ON storage.objects FOR UPDATE TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated Deletes" ON storage.objects FOR DELETE TO authenticated USING (true);

-- Final Force Schema Cache Reload
NOTIFY pgrst, 'reload schema';

-- ==========================================
-- 17. CHAT MESSAGES PAYLOAD COLUMN
-- ==========================================
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT NULL;

-- Final Force Schema Cache Reload
NOTIFY pgrst, 'reload schema';




