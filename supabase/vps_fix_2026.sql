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

CREATE OR REPLACE FUNCTION public.create_user_admin(
    p_email TEXT,
    p_password TEXT DEFAULT 'PandaNet123!',
    p_full_name TEXT DEFAULT 'Novo Usuário',
    p_role TEXT DEFAULT 'Employee',
    p_team TEXT DEFAULT 'Geral',
    p_company_id UUID DEFAULT NULL,
    p_is_admin BOOLEAN DEFAULT FALSE,
    p_is_company_admin BOOLEAN DEFAULT FALSE,
    p_permissions JSONB DEFAULT '{}'::jsonb,
    p_avatar_url TEXT DEFAULT NULL,
    p_department_id UUID DEFAULT NULL,
    p_rg TEXT DEFAULT NULL,
    p_cpf TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_new_user_id UUID;
    v_encrypted_pw TEXT;
BEGIN
    -- 1. Create user in auth.users
    v_new_user_id := gen_random_uuid();
    v_encrypted_pw := crypt(COALESCE(p_password, 'PandaNet123!'), gen_salt('bf'));

    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, 
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
        created_at, updated_at, confirmation_token, recovery_token
    )
    VALUES (
        v_new_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        p_email,
        v_encrypted_pw,
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', p_full_name),
        now(),
        now(),
        encode(gen_random_bytes(32), 'hex'),
        encode(gen_random_bytes(32), 'hex')
    );

    -- 2. Create entry in auth.identities
    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id
    ) VALUES (
        gen_random_uuid(),
        v_new_user_id,
        jsonb_build_object('sub', v_new_user_id::text, 'email', p_email),
        'email',
        now(),
        now(),
        now(),
        v_new_user_id::text
    );

    -- 3. Create entry in public.profiles
    INSERT INTO public.profiles (
        id, email, full_name, role, team, company_id, 
        is_admin, is_company_admin, permissions, avatar_url, 
        department_id, rg, cpf, status, created_at, updated_at
    )
    VALUES (
        v_new_user_id,
        p_email, 
        p_full_name, 
        p_role,
        p_team,
        p_company_id, 
        p_is_admin, 
        p_is_company_admin, 
        p_permissions,
        p_avatar_url,
        p_department_id,
        p_rg,
        p_cpf,
        'active',
        now(),
        now()
    );

    RETURN v_new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user profiles (Bypass RLS for Admins)
CREATE OR REPLACE FUNCTION public.update_user_profile(
    p_user_id TEXT,
    p_full_name TEXT DEFAULT NULL,
    p_role TEXT DEFAULT NULL,
    p_team TEXT DEFAULT NULL,
    p_department_id TEXT DEFAULT NULL,
    p_is_admin BOOLEAN DEFAULT NULL,
    p_is_company_admin BOOLEAN DEFAULT NULL,
    p_permissions JSONB DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL,
    p_rg TEXT DEFAULT NULL,
    p_cpf TEXT DEFAULT NULL,
    p_emergency_contact_name TEXT DEFAULT NULL,
    p_emergency_contact_phone TEXT DEFAULT NULL,
    p_health_insurance TEXT DEFAULT NULL,
    p_blood_type TEXT DEFAULT NULL,
    p_marital_status TEXT DEFAULT NULL,
    p_education_level TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_user_uuid UUID;
BEGIN
    v_user_uuid := p_user_id::UUID;
    
    UPDATE public.profiles
    SET
        full_name = COALESCE(p_full_name, full_name),
        role = COALESCE(p_role, role),
        team = COALESCE(p_team, team),
        department_id = CASE 
            WHEN p_department_id IS NULL THEN department_id 
            WHEN p_department_id = '' THEN NULL 
            ELSE p_department_id::UUID 
        END,
        is_admin = COALESCE(p_is_admin, is_admin),
        is_company_admin = COALESCE(p_is_company_admin, is_company_admin),
        permissions = COALESCE(p_permissions, permissions),
        avatar_url = COALESCE(p_avatar_url, avatar_url),
        rg = COALESCE(p_rg, rg),
        cpf = COALESCE(p_cpf, cpf),
        emergency_contact_name = COALESCE(p_emergency_contact_name, emergency_contact_name),
        emergency_contact_phone = COALESCE(p_emergency_contact_phone, emergency_contact_phone),
        health_insurance = COALESCE(p_health_insurance, health_insurance),
        blood_type = COALESCE(p_blood_type, blood_type),
        marital_status = COALESCE(p_marital_status, marital_status),
        education_level = COALESCE(p_education_level, education_level),
        updated_at = NOW()
    WHERE id = v_user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to securely delete a user (Auth + Profile) on VPS
CREATE OR REPLACE FUNCTION public.delete_user_admin(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM auth.identities WHERE user_id = target_user_id;
    DELETE FROM auth.users WHERE id = target_user_id;
    DELETE FROM public.profiles WHERE id = target_user_id;
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
GRANT EXECUTE ON FUNCTION public.update_user_profile(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_user_admin(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_user_admin(UUID) TO authenticated, service_role;

-- Force Schema Cache Reload (Standard trick)
NOTIFY pgrst, 'reload schema';
