-- =============================================================
-- PANDANET - FIX DEFINITIVO: CRIAÇÃO DE USUÁRIOS
-- Aplique no SQL Editor do seu Supabase self-hosted
-- Este script substitui a função create_user_admin antiga
-- pela versão correta com TODOS os campos obrigatórios
-- =============================================================


-- PASSO 1: Remove versões antigas da função
DROP FUNCTION IF EXISTS public.create_user_admin(TEXT,TEXT,TEXT,TEXT,TEXT,UUID,BOOLEAN,BOOLEAN,JSONB,TEXT,UUID,TEXT,TEXT,BOOLEAN,INTEGER,BOOLEAN,JSONB,JSONB);
DROP FUNCTION IF EXISTS public.create_user_admin(TEXT,TEXT,TEXT,TEXT,TEXT,UUID,BOOLEAN,BOOLEAN,JSONB,TEXT,UUID,TEXT,TEXT,BOOLEAN,INTEGER,BOOLEAN,JSONB);
DROP FUNCTION IF EXISTS public.create_user_admin(TEXT,TEXT,TEXT,TEXT,TEXT,UUID,BOOLEAN,BOOLEAN,JSONB,TEXT,UUID,TEXT,TEXT);


-- PASSO 2: Cria a nova função correta
CREATE OR REPLACE FUNCTION public.create_user_admin(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_role TEXT DEFAULT 'Colaborador',
    p_team TEXT DEFAULT 'Geral',
    p_company_id UUID DEFAULT NULL,
    p_is_admin BOOLEAN DEFAULT FALSE,
    p_is_company_admin BOOLEAN DEFAULT FALSE,
    p_permissions JSONB DEFAULT '{}',
    p_avatar_url TEXT DEFAULT NULL,
    p_department_id UUID DEFAULT NULL,
    p_rg TEXT DEFAULT NULL,
    p_cpf TEXT DEFAULT NULL,
    p_can_nudge BOOLEAN DEFAULT TRUE,
    p_nudge_cooldown INTEGER DEFAULT 30,
    p_is_whatsapp_agent BOOLEAN DEFAULT FALSE,
    p_whatspanda_permissions JSONB DEFAULT '{}',
    p_email_permissions JSONB DEFAULT '{}',
    p_join_date DATE DEFAULT NULL
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
    -- Verificação de permissão do chamador
    SELECT
        company_id,
        (role = 'Super Admin'),
        (is_company_admin OR is_admin OR role = ANY(ARRAY['admin', 'Company Admin', 'Gestor', 'Administrador']))
    INTO v_caller_company_id, v_caller_is_super, v_caller_is_admin
    FROM public.profiles
    WHERE id = auth.uid();

    IF NOT (v_caller_is_super OR (v_caller_is_admin AND (p_company_id IS NULL OR v_caller_company_id = p_company_id))) THEN
        RAISE EXCEPTION 'Permissão negada para criar usuário nesta empresa.';
    END IF;

    -- Se não-super admin, força o company_id da própria empresa
    IF NOT v_caller_is_super THEN
        p_company_id := v_caller_company_id;
    END IF;

    -- Verifica se email já existe
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
        RAISE EXCEPTION 'Email % já está cadastrado.', p_email;
    END IF;

    -- Gera UUID e hash da senha
    v_new_id := gen_random_uuid();
    v_encrypted_pw := crypt(p_password, gen_salt('bf'));

    -- PASSO 1: Cria o usuário no Auth com TODOS os campos obrigatórios
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        confirmation_token,
        confirmation_sent_at,
        recovery_token,
        recovery_sent_at,
        email_change_token_new,
        email_change,
        email_change_sent_at,
        email_change_token_current,
        email_change_confirm_status,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        created_at,
        updated_at,
        phone,
        phone_confirmed_at,
        phone_change,
        phone_change_token,
        phone_change_sent_at,
        banned_until,
        reauthentication_token,
        reauthentication_sent_at,
        is_sso_user,
        deleted_at,
        role,
        aud
    ) VALUES (
        v_new_id,
        '00000000-0000-0000-0000-000000000000',
        p_email,
        v_encrypted_pw,
        NOW(),          -- email já confirmado, não precisa verificar
        '',             -- confirmation_token vazio (já confirmado)
        NULL,
        '',             -- recovery_token vazio
        NULL,
        '',             -- email_change_token_new vazio
        '',             -- email_change vazio
        NULL,
        '',             -- email_change_token_current vazio
        0,              -- email_change_confirm_status
        NULL,
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', p_full_name),
        FALSE,
        NOW(),
        NOW(),
        NULL,           -- phone
        NULL,           -- phone_confirmed_at
        '',             -- phone_change
        '',             -- phone_change_token
        NULL,
        NULL,           -- banned_until
        '',             -- reauthentication_token
        NULL,
        FALSE,          -- is_sso_user
        NULL,           -- deleted_at
        'authenticated',
        'authenticated'
    );

    -- PASSO 2: Cria o perfil completo (upsert caso trigger já tenha criado um parcial)
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        team,
        company_id,
        is_admin,
        is_company_admin,
        permissions,
        avatar_url,
        department_id,
        rg,
        cpf,
        status,
        can_nudge,
        nudge_cooldown,
        is_whatsapp_agent,
        whatspanda_permissions,
        email_permissions,
        join_date
    ) VALUES (
        v_new_id,
        p_email,
        p_full_name,
        p_role,
        p_team,
        p_company_id,
        p_is_admin,
        p_is_company_admin,
        COALESCE(p_permissions, '{}'),
        p_avatar_url,
        p_department_id,
        p_rg,
        p_cpf,
        'active',
        p_can_nudge,
        p_nudge_cooldown,
        p_is_whatsapp_agent,
        COALESCE(p_whatspanda_permissions, '{}'),
        COALESCE(p_email_permissions, '{}'),
        COALESCE(p_join_date, CURRENT_DATE)
    )
    ON CONFLICT (id) DO UPDATE SET
        email           = EXCLUDED.email,
        full_name       = EXCLUDED.full_name,
        role            = EXCLUDED.role,
        team            = EXCLUDED.team,
        company_id      = EXCLUDED.company_id,
        is_admin        = EXCLUDED.is_admin,
        is_company_admin = EXCLUDED.is_company_admin,
        permissions     = EXCLUDED.permissions,
        avatar_url      = EXCLUDED.avatar_url,
        department_id   = EXCLUDED.department_id,
        status          = 'active',
        can_nudge       = EXCLUDED.can_nudge,
        nudge_cooldown  = EXCLUDED.nudge_cooldown,
        is_whatsapp_agent = EXCLUDED.is_whatsapp_agent,
        whatspanda_permissions = EXCLUDED.whatspanda_permissions,
        email_permissions = EXCLUDED.email_permissions;

    RETURN v_new_id;

EXCEPTION
    WHEN OTHERS THEN
        -- Se o perfil falhou mas o auth foi criado, tenta limpar
        BEGIN
            DELETE FROM auth.users WHERE id = v_new_id;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        RAISE;
END;
$$;

-- Garante que só admins e super admins podem chamar
REVOKE ALL ON FUNCTION public.create_user_admin FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_user_admin TO authenticated;


-- =============================================================
-- PASSO 3: Trigger de segurança (rede de proteção)
-- Garante que qualquer usuário criado no Auth terá um perfil
-- mínimo — previne "Database error querying schema" para sempre
-- =============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        team,
        status,
        can_nudge,
        nudge_cooldown,
        permissions
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'Colaborador',
        'Geral',
        'active',
        true,
        30,
        '{}'::jsonb
    )
    ON CONFLICT (id) DO NOTHING;
    -- Se o perfil já foi criado pela função create_user_admin, não sobrescreve

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_profile();


-- =============================================================
-- VERIFICAÇÃO FINAL
-- Rode após aplicar — deve retornar 0 linhas
-- =============================================================
SELECT au.id, au.email, 'SEM PERFIL' AS problema
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;
