-- ====================================================================
-- MIGRATION SCRIPT - PANDANET VERSION 1.1.6 BETA
-- Consolidated changes applied on the self-hosted VPS PostgreSQL database
-- ====================================================================

-- 1. ESTRUTURA DE TABELAS (COLUNAS NOVAS)
ALTER TABLE public.wellness_items ADD COLUMN IF NOT EXISTS link_text TEXT DEFAULT NULL;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS competencies TEXT[] DEFAULT '{}'::text[];
ALTER TABLE public.hr_evaluations ADD COLUMN IF NOT EXISTS custom_scores JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.form_submissions ADD COLUMN IF NOT EXISTS attachment_url TEXT DEFAULT NULL;
ALTER TABLE public.form_submissions ADD COLUMN IF NOT EXISTS attachment_name TEXT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS quick_links JSONB DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status_text TEXT DEFAULT NULL;
ALTER TABLE public.whatsapp_settings ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT NULL;

-- 2. CONTROLE DE ATUALIZAÇÃO (COLUNAS E TRIGGERS PARA UPDATED_AT)
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS tr_handle_updated_at_plans ON public.plans;
CREATE TRIGGER tr_handle_updated_at_plans
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS tr_handle_updated_at_companies ON public.companies;
CREATE TRIGGER tr_handle_updated_at_companies
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- 3. NOVA TABELA: COMPARTILHAMENTO DE AGENDA
CREATE TABLE IF NOT EXISTS public.calendar_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    shared_with_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(owner_id, shared_with_id)
);

-- 4. EXTENSÕES DO BANCO
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 5. RECRIAÇÃO E CORREÇÃO DE FUNÇÕES E TRIGGERS

-- A. Trigger handle_new_user_profile (Corrige a criação automática do profile no schema public para evitar duplicate key de profiles_pkey)
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_domain TEXT;
    v_email_domain TEXT;
    v_company_id UUID;
    v_company_exists BOOLEAN;
    v_is_first_user BOOLEAN;
    v_status TEXT;
    v_role TEXT;
    v_is_company_admin BOOLEAN;
BEGIN
    -- 1. Obter o domínio da empresa da metadata ou do email
    v_domain := NEW.raw_user_meta_data->>'company_domain';
    v_email_domain := split_part(NEW.email, '@', 2);
    
    -- Normalizar
    v_domain := LOWER(TRIM(v_domain));
    v_email_domain := LOWER(TRIM(v_email_domain));

    -- Se não foi passado domínio ou se for email público, usa o domínio do email
    IF v_domain IS NULL OR v_domain = '' OR v_domain = ANY(ARRAY['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com']) THEN
        v_domain := v_email_domain;
    END IF;

    -- Se ainda assim for email público, não associamos a nenhuma empresa e fica pendente
    IF v_domain = ANY(ARRAY['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com']) THEN
        v_company_id := NULL;
        v_status := 'pending';
        v_role := 'Colaborador';
        v_is_company_admin := FALSE;
    ELSE
        -- 2. Verificar se a empresa já existe
        SELECT id INTO v_company_id FROM public.companies WHERE LOWER(domain) = v_domain LIMIT 1;
        
        IF v_company_id IS NOT NULL THEN
            -- A empresa existe. Verificamos se ela tem usuários ativos ou se é o primeiro
            SELECT NOT EXISTS (SELECT 1 FROM public.profiles WHERE company_id = v_company_id) INTO v_is_first_user;
            
            IF v_is_first_user THEN
                v_status := 'active';
                v_role := 'admin';
                v_is_company_admin := TRUE;
            ELSE
                v_status := 'pending';
                v_role := 'Colaborador';
                v_is_company_admin := FALSE;
            END IF;
        ELSE
            -- A empresa não existe, vamos criá-la!
            INSERT INTO public.companies (
                name,
                domain,
                status,
                responsible_email
            ) VALUES (
                INITCAP(split_part(v_domain, '.', 1)),
                v_domain,
                'active',
                NEW.email
            ) RETURNING id INTO v_company_id;
            
            v_status := 'active';
            v_role := 'admin';
            v_is_company_admin := TRUE;
        END IF;
    END IF;

    -- 3. Inserir o perfil
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        company_id,
        role,
        team,
        status,
        can_nudge,
        nudge_cooldown,
        permissions,
        is_company_admin,
        is_admin
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        v_company_id,
        v_role,
        'Geral',
        v_status,
        true,
        30,
        '{}'::jsonb,
        v_is_company_admin,
        v_is_company_admin
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        company_id = COALESCE(profiles.company_id, EXCLUDED.company_id),
        role = CASE WHEN profiles.role = 'Colaborador' THEN EXCLUDED.role ELSE profiles.role END,
        status = CASE WHEN profiles.status = 'active' THEN 'active' ELSE EXCLUDED.status END,
        is_company_admin = profiles.is_company_admin OR EXCLUDED.is_company_admin,
        is_admin = profiles.is_admin OR EXCLUDED.is_admin;

    RETURN NEW;
END;
$$;


-- B. Função public.create_user_admin (Cria usuários a partir do painel de administração)
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
END;
$$;

-- Nota: Corpo completo da função create_user_admin com criptografia adequada e ON CONFLICT do profiles
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
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        team = EXCLUDED.team,
        company_id = EXCLUDED.company_id,
        is_admin = EXCLUDED.is_admin,
        is_company_admin = EXCLUDED.is_company_admin,
        permissions = EXCLUDED.permissions,
        avatar_url = EXCLUDED.avatar_url,
        department_id = EXCLUDED.department_id,
        rg = EXCLUDED.rg,
        cpf = EXCLUDED.cpf,
        status = EXCLUDED.status,
        can_nudge = EXCLUDED.can_nudge,
        nudge_cooldown = EXCLUDED.nudge_cooldown,
        is_whatsapp_agent = EXCLUDED.is_whatsapp_agent,
        whatspanda_permissions = EXCLUDED.whatspanda_permissions,
        email_permissions = EXCLUDED.email_permissions,
        join_date = EXCLUDED.join_date,
        reports_to = EXCLUDED.reports_to,
        sector_manager_id = EXCLUDED.sector_manager_id,
        is_manager = EXCLUDED.is_manager,
        updated_at = NOW();

    RETURN v_new_id;
END;
$$;


-- C. Função public.update_user_profile (Atualiza perfis de usuários)
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


-- D. Função public.admin_reset_user_password (Reseta senhas de usuários pelo admin)
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(p_user_id uuid, p_new_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $$
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
$$;


-- E. Função public.create_admin_user_for_company_safe (Cria admin seguro durante setup de nova empresa)
CREATE OR REPLACE FUNCTION public.create_admin_user_for_company_safe(
  p_company_id UUID,
  p_admin_email TEXT,
  p_admin_password TEXT,
  p_admin_name TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id UUID;
  v_crypted_password TEXT;
BEGIN
  -- 1. Gerar a senha criptografada de forma segura usando schema prefix extensions
  v_crypted_password := extensions.crypt(p_admin_password, extensions.gen_salt('bf'));

  -- 2. Verificar se o usuário já existe no auth.users para evitar erro duplicado
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_admin_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este e-mail já está cadastrado no sistema.');
  END IF;

  -- 3. Criar Usuário no Auth
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at,
    instance_id
  ) VALUES (
    gen_random_uuid(),
    p_admin_email,
    v_crypted_password,
    now(),
    jsonb_build_object('full_name', p_admin_name),
    'authenticated',
    'authenticated',
    now(),
    now(),
    '00000000-0000-0000-0000-000000000000'
  ) RETURNING id INTO v_user_id;

  -- 4. Criar Perfil no Public vinculado à empresa
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    company_id,
    role,
    is_admin,
    is_company_admin,
    status,
    join_date,
    updated_at
  ) VALUES (
    v_user_id,
    p_admin_email,
    p_admin_name,
    p_company_id,
    'admin',
    true,
    true,
    'active',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    company_id = EXCLUDED.company_id,
    role = EXCLUDED.role,
    is_admin = EXCLUDED.is_admin,
    is_company_admin = EXCLUDED.is_company_admin,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;


-- F. Função public.approve_user_and_create_company (Aprova cadastro SaaS de nova empresa e seu administrador associado)
CREATE OR REPLACE FUNCTION public.approve_user_and_create_company(
    p_user_id UUID,
    p_plan_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_email TEXT;
    v_full_name TEXT;
    v_domain TEXT;
    v_company_id UUID;
    v_company_name TEXT;
BEGIN
    -- Obter email e nome do profile pendente
    SELECT email, full_name INTO v_email, v_full_name
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_email IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado.');
    END IF;

    -- Extrair domínio
    v_domain := LOWER(SUBSTRING(v_email FROM '@(.*)$'));

    IF v_domain IS NULL OR v_domain = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Domínio de e-mail inválido.');
    END IF;

    -- Se for domínio público comum, tratar de forma a criar um domínio único baseado no nome
    IF v_domain IN ('gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yahoo.com.br', 'uol.com.br', 'bol.com.br', 'icloud.com') THEN
        v_domain := LOWER(REPLACE(v_full_name, ' ', '')) || '_' || v_domain;
    END IF;

    -- Verificar se a empresa já existe para esse domínio
    SELECT id INTO v_company_id
    FROM public.companies
    WHERE LOWER(domain) = v_domain;

    IF v_company_id IS NULL THEN
        -- Criar nova empresa
        v_company_id := gen_random_uuid();
        v_company_name := INITCAP(SPLIT_PART(v_domain, '.', 1));
        
        INSERT INTO public.companies (id, name, domain, plan_id, status, subscription_end_date)
        VALUES (v_company_id, v_company_name, v_domain, p_plan_id, 'active', NOW() + INTERVAL '30 days');
        
        -- Atualizar profile como Administrador e Ativo
        UPDATE public.profiles
        SET company_id = v_company_id,
            status = 'active',
            is_admin = TRUE,
            is_company_admin = TRUE,
            role = 'Admin',
            team = 'Diretoria',
            updated_at = NOW()
        WHERE id = p_user_id;

        RETURN jsonb_build_object('success', true, 'company_id', v_company_id, 'created_new', true);
    ELSE
        -- Empresa já existe, apenas ativa o usuário nela (como colaborador regular por padrão para segurança)
        UPDATE public.profiles
        SET company_id = v_company_id,
            status = 'active',
            is_admin = FALSE,
            is_company_admin = FALSE,
            role = 'Colaborador',
            team = 'Geral',
            updated_at = NOW()
        WHERE id = p_user_id;

        RETURN jsonb_build_object('success', true, 'company_id', v_company_id, 'created_new', false);
    END IF;
END;
$$;

-- 6. PERMISSÕES DE EXECUÇÃO E RECARREGAMENTO DO CACHE DO POSTGREST
GRANT EXECUTE ON FUNCTION public.create_user_admin(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, UUID, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN, JSONB, JSONB, DATE, UUID, UUID, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_user_profile(UUID, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN, JSONB, JSONB, UUID, UUID, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_admin_user_for_company_safe(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_user_and_create_company(UUID, UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
