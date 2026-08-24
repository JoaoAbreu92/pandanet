-- =========================================================================
-- PandaNet - Novo RPC para Adicionar Usuário Admin Manualmente
-- Permite que o Super Admin adicione usuários a empresas já existentes.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.create_admin_user_for_company_safe(
  p_company_id UUID,
  p_admin_email TEXT,
  p_admin_password TEXT,
  p_admin_name TEXT
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_crypted_password TEXT;
BEGIN
    -- 1. Gerar a senha criptografada de forma segura
    BEGIN
        v_crypted_password := public.crypt(p_admin_password, public.gen_salt('bf'));
    EXCEPTION WHEN OTHERS THEN
        -- Fallback caso o schema public não esteja no search_path ou extensão esteja em outro lugar
        v_crypted_password := crypt(p_admin_password, gen_salt('bf'));
    END;

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
    created_at,
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
  );

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
$$ LANGUAGE plpgsql SECURITY DEFINER;
