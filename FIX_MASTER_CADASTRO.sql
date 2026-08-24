-- =========================================================================
-- PandaNet - SCRIPT DE SANEAMENTO TOTAL (BANCO DE DADOS)
-- Corrigi Erro 500 no Cadastro e Falha na Criação de Empresa no Painel SaaS
-- =========================================================================

-- 1. HABILITAR EXTENSÕES NECESSÁRIAS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. AJUSTAR ESTRUTURA DA TABELA NOTIFICATIONS
-- Garante que as colunas batam com o que o CÓDIGO e o TRIGGER esperam
DO $$ 
BEGIN 
    -- Renomear ou criar colunas se necessário
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='profile_id') THEN
        ALTER TABLE public.notifications RENAME COLUMN profile_id TO user_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='message') THEN
        ALTER TABLE public.notifications RENAME COLUMN message TO description;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='read') THEN
        ALTER TABLE public.notifications RENAME COLUMN read TO is_read;
    END IF;

    -- Garantir tipos corretos
    ALTER TABLE public.notifications ALTER COLUMN is_read SET DEFAULT false;
END $$;

-- Garantir que a coluna company_id aceita NULL (para notificações de sistema)
ALTER TABLE public.notifications ALTER COLUMN company_id DROP NOT NULL;

-- 3. LIMPEZA DE TRIGGERS ANTIGOS
DROP TRIGGER IF EXISTS tr_notify_superadmin_on_validation ON public.profiles;
DROP TRIGGER IF EXISTS tr_notify_superadmin_new_user ON public.profiles;
DROP TRIGGER IF EXISTS tr_notify_superadmin_registration_v2 ON public.profiles;
DROP FUNCTION IF EXISTS public.notify_superadmin_on_new_registration();
DROP FUNCTION IF EXISTS public.notify_superadmin_new_user();
DROP FUNCTION IF EXISTS public.fn_notify_superadmin_registration_v2();

-- 4. NOVA FUNÇÃO DE NOTIFICAÇÃO (VERSÃO FINAL ROBUSTA)
CREATE OR REPLACE FUNCTION public.fn_notify_superadmin_registration_final()
RETURNS TRIGGER AS $$
DECLARE
    superadmin_id UUID;
BEGIN
    -- Busca o ID do SuperAdmin (ti@grupopixel.com.br)
    SELECT id INTO superadmin_id FROM public.profiles WHERE email = 'ti@grupopixel.com.br' LIMIT 1;
    
    IF NEW.status = 'pending' AND superadmin_id IS NOT NULL THEN
        INSERT INTO public.notifications (
            user_id,
            title,
            description,
            type,
            is_read,
            link,
            company_id      -- Agora passando NULL para notificações de sistema
        ) VALUES (
            superadmin_id,
            'Novo Cadastro Pendente',
            'O usuário ' || COALESCE(NEW.full_name, 'Novo Usuário') || ' (' || NEW.email || ') aguarda validação.',
            'alert',
            false,
            '/saas-dashboard?tab=validations',
            NULL -- IMPORTANTE: Não usar 'root' aqui se a coluna for UUID
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RE-APLICAR TRIGGER
CREATE TRIGGER tr_notify_superadmin_registration_final
AFTER INSERT OR UPDATE OF status ON public.profiles
FOR EACH ROW
WHEN (NEW.status = 'pending')
EXECUTE FUNCTION public.fn_notify_superadmin_registration_final();

-- 6. FUNÇÃO RPC PARA CRIAÇÃO DE EMPRESA (VERSÃO FINAL)
-- Corrigida para garantir a inserção no auth.users e public.profiles
CREATE OR REPLACE FUNCTION public.create_company_with_admin_final(
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
BEGIN
  -- 1. Criar a Empresa
  INSERT INTO public.companies (
    name, 
    domain, 
    cnpj, 
    plan_id, 
    status, 
    subscription_end_date,
    responsible_name,
    responsible_email,
    settings
  ) VALUES (
    p_company_name, 
    p_company_domain, 
    p_company_cnpj, 
    p_plan_id, 
    'active', 
    now() + interval '30 days',
    p_admin_name,
    p_admin_email,
    jsonb_build_object('companyName', p_company_name)
  ) RETURNING id INTO v_company_id;

  -- 2. Criar Usuário no Schema Auth (Usando crypt da pgcrypto)
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
    crypt(p_admin_password, gen_salt('bf')),
    now(),
    jsonb_build_object('full_name', p_admin_name),
    'authenticated',
    'authenticated',
    now(),
    now(),
    '00000000-0000-0000-0000-000000000000'
  ) RETURNING id INTO v_user_id;

  -- 3. Criar Perfil no Schema Public
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    company_id,
    role,
    is_admin,
    is_company_admin,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_admin_email,
    p_admin_name,
    v_company_id,
    'admin',
    true,
    true,
    'active',
    now(),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'company_id', v_company_id,
    'user_id', v_user_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
