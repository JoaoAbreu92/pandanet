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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RLS FIXES
-- Allow admins to update any profile in their company
DROP POLICY IF EXISTS "Admin manage all profiles in company" ON public.profiles;
CREATE POLICY "Admin manage all profiles in company" ON public.profiles
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND (is_admin = TRUE OR is_company_admin = TRUE)
        AND company_id = public.profiles.company_id
    )
);

-- Ensure execute permissions
GRANT EXECUTE ON FUNCTION public.update_user_profile(UUID, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN, JSONB, JSONB, UUID, UUID, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_user_admin(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, UUID, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN, JSONB, JSONB, DATE, UUID, UUID, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_user_admin(UUID) TO authenticated, service_role;;

-- Force Schema Cache Reload (Standard trick)
NOTIFY pgrst, 'reload schema';
