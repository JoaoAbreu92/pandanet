-- PandaNet - FUNÇÃO RPC PARA CRIAÇÃO DE EMPRESA COM ADMIN
-- Esta função cria uma empresa e um usuário administrador de forma atômica.

CREATE OR REPLACE FUNCTION public.create_company_with_admin(
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
  v_encrypted_pw TEXT;
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

  -- 2. Encriptar Senha
  -- Nota: supõe que a extensão pgcrypto está disponível (padrão Supabase)
  v_encrypted_pw := crypt(p_admin_password, gen_salt('bf'));

  -- 3. Criar Usuário no Schema Auth
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_admin_email,
    v_encrypted_pw,
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', p_admin_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO v_user_id;

  -- 4. Criar/Atualizar Perfil no Schema Public
  -- Garantimos que o perfil tenha os vínculos corretos
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
  )
  ON CONFLICT (id) DO UPDATE SET
    company_id = v_company_id,
    role = 'admin',
    is_admin = true,
    is_company_admin = true,
    status = 'active',
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'company_id', v_company_id,
    'user_id', v_user_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
