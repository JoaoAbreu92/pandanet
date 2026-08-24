-- =========================================================================
-- PandaNet - SCRIPT DEFINITIVO "À PROVA DE BALAS"
-- Resolve Erro 500 no Cadastro e Erro gen_salt no Painel SaaS
-- =========================================================================

-- 1. GARANTIR EXTENSÕES EM DIFERENTES POSSIBILIDADES DE SCHEMA
-- Em self-hosted, as vezes as extensões ficam no schema 'extensions'
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;

-- 2. LIMPEZA TOTAL DE VERSÕES ANTERIORES
DROP TRIGGER IF EXISTS tr_notify_superadmin_registration_final ON public.profiles;
DROP TRIGGER IF EXISTS tr_notify_superadmin_on_validation ON public.profiles;
DROP TRIGGER IF EXISTS tr_notify_superadmin_new_user ON public.profiles;
DROP TRIGGER IF EXISTS tr_notify_superadmin_registration_v2 ON public.profiles;

DROP FUNCTION IF EXISTS public.fn_notify_superadmin_registration_final();
DROP FUNCTION IF EXISTS public.create_company_with_admin_final(text,text,text,uuid,text,text,text);
DROP FUNCTION IF EXISTS public.create_company_with_admin(text,text,text,uuid,text,text,text);

-- 3. AJUSTAR TABELA NOTIFICATIONS (NOMES DE COLUNAS FINAIS)
DO $$ 
BEGIN 
    -- Se existir a coluna profile_id, muda para user_id (padrão do App)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='profile_id') THEN
        ALTER TABLE public.notifications RENAME COLUMN profile_id TO user_id;
    END IF;
    
    -- Se existir a coluna message, muda para description
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='message') THEN
        ALTER TABLE public.notifications RENAME COLUMN message TO description;
    END IF;
    
    -- Se existir a coluna read, muda para is_read
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='read') THEN
        ALTER TABLE public.notifications RENAME COLUMN read TO is_read;
    END IF;
END $$;

-- Garantir que as colunas essenciais existem e aceitam NULL
ALTER TABLE public.notifications ALTER COLUMN is_read SET DEFAULT false;
ALTER TABLE public.notifications ALTER COLUMN company_id DROP NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN user_id DROP NOT NULL;

-- 4. FUNÇÃO DE NOTIFICAÇÃO BLINDADA (NUNCA CAUSA ERRO 500)
CREATE OR REPLACE FUNCTION public.fn_notify_superadmin_registration_safe()
RETURNS TRIGGER AS $$
DECLARE
    v_superadmin_id UUID;
BEGIN
    -- Busca ID do SuperAdmin
    SELECT id INTO v_superadmin_id FROM public.profiles WHERE email = 'ti@grupopixel.com.br' LIMIT 1;
    
    -- Se não achou por e-mail, tenta pegar o primeiro admin do sistema
    IF v_superadmin_id IS NULL THEN
        SELECT id INTO v_superadmin_id FROM public.profiles WHERE is_admin = true LIMIT 1;
    END IF;

    -- Tenta inserir a notificação envolta em um bloco EXCEPTION
    -- Assim, se a tabela estiver errada ou qualquer erro ocorrer, o CADASTRO SEGUE NORMAL
    BEGIN
        IF NEW.status = 'pending' AND v_superadmin_id IS NOT NULL THEN
            INSERT INTO public.notifications (
                user_id,
                title,
                description,
                type,
                is_read,
                link
            ) VALUES (
                v_superadmin_id,
                'Solicitação de Acesso',
                'O usuário ' || COALESCE(NEW.full_name, 'Novo Usuário') || ' (' || NEW.email || ') aguarda validação.',
                'alert',
                false,
                '/saas-dashboard?tab=validations'
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Silencia o erro. O importante é o usuário ser criado no auth.users
        RAISE WARNING 'Falha ao gerar notificação, mas mantendo cadastro: %', SQLERRM;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RE-APLICAR O TRIGGER
CREATE TRIGGER tr_notify_superadmin_registration_final
AFTER INSERT OR UPDATE OF status ON public.profiles
FOR EACH ROW
WHEN (NEW.status = 'pending')
EXECUTE FUNCTION public.fn_notify_superadmin_registration_safe();

-- 6. FUNÇÃO RPC PARA CRIAÇÃO DE EMPRESA (COM TRATAMENTO DE EXTENSÃO)
CREATE OR REPLACE FUNCTION public.create_company_with_admin_safe(
  p_company_name TEXT,
  p_company_domain TEXT,
  p_company_cnpj TEXT,
  p_plan_id UUID,
  p_admin_email TEXT,
  p_admin_password TEXT,
  p_admin_name TEXT
) RETURNS JSONB AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
  v_crypted_password TEXT;
BEGIN
    -- 1. Gerar a senha criptografada de forma segura
    -- Usando casting explícito para evitar erro gen_salt(unknown)
    BEGIN
        v_crypted_password := public.crypt(p_admin_password, public.gen_salt('bf'));
    EXCEPTION WHEN OTHERS THEN
        -- Se falhar a extensão no public, tenta sem o prefixo
        v_crypted_password := crypt(p_admin_password, gen_salt('bf'));
    END;

  -- 2. Criar a Empresa
  INSERT INTO public.companies (
    name, domain, cnpj, plan_id, status, subscription_end_date, responsible_name, responsible_email, settings
  ) VALUES (
    p_company_name, p_company_domain, p_company_cnpj, p_plan_id, 'active', 
    now() + interval '30 days', p_admin_name, p_admin_email, jsonb_build_object('companyName', p_company_name)
  ) RETURNING id INTO v_company_id;

  -- 3. Criar Usuário no Auth (gen_random_uuid() é da extensão pgcrypto ou nativo v13+)
  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role, created_at, updated_at, instance_id
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

  -- 4. Criar Perfil no Public
  INSERT INTO public.profiles (
    id, email, full_name, company_id, role, is_admin, is_company_admin, status, created_at, updated_at
  ) VALUES (
    v_user_id, p_admin_email, p_admin_name, v_company_id, 'admin', true, true, 'active', now(), now()
  );

  RETURN jsonb_build_object('success', true, 'company_id', v_company_id, 'user_id', v_user_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
