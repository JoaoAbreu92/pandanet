/**
 * apply_fix_create_user.js
 * Drops all versions of create_user_admin and update_user_profile,
 * and recreates them with correct extensions prefix.
 */

const supabaseUrl = 'http://77.37.43.60:8000';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.qCZ-7mxAsMtLJDBKicjET6woXEXLm32izoPLqgDHIZg';

const headers = {
  'Content-Type': 'application/json',
  'apikey': serviceKey,
  'Authorization': `Bearer ${serviceKey}`
};

async function execSQL(sql) {
  const res = await fetch(`${supabaseUrl}/pg/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: sql })
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

async function run() {
  console.log('1. Dropping all existing versions of create_user_admin and update_user_profile...');
  const dropSQL = `
    DO $$
    DECLARE
        r RECORD;
    BEGIN
        -- Drop all public.create_user_admin functions
        FOR r IN 
            SELECT pg_proc.oid::regprocedure::text as func_signature
            FROM pg_proc 
            JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
            WHERE proname = 'create_user_admin' 
            AND nspname = 'public'
        LOOP
            EXECUTE 'DROP FUNCTION ' || r.func_signature;
        END LOOP;

        -- Drop all public.update_user_profile functions
        FOR r IN 
            SELECT pg_proc.oid::regprocedure::text as func_signature
            FROM pg_proc 
            JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
            WHERE proname = 'update_user_profile' 
            AND nspname = 'public'
        LOOP
            EXECUTE 'DROP FUNCTION ' || r.func_signature;
        END LOOP;
        
        -- Drop all public.admin_reset_user_password functions
        FOR r IN 
            SELECT pg_proc.oid::regprocedure::text as func_signature
            FROM pg_proc 
            JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
            WHERE proname = 'admin_reset_user_password' 
            AND nspname = 'public'
        LOOP
            EXECUTE 'DROP FUNCTION ' || r.func_signature;
        END LOOP;

        -- Drop all public.create_admin_user_for_company_safe functions
        FOR r IN 
            SELECT pg_proc.oid::regprocedure::text as func_signature
            FROM pg_proc 
            JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
            WHERE proname = 'create_admin_user_for_company_safe' 
            AND nspname = 'public'
        LOOP
            EXECUTE 'DROP FUNCTION ' || r.func_signature;
        END LOOP;
    END;
    $$;
  `;

  let res = await execSQL(dropSQL);
  console.log('Drop Status:', res.status);
  console.log('Drop Response:', res.body);

  console.log('\n2. Creating pgcrypto extension if not exists...');
  res = await execSQL(`CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;`);
  console.log('Extension Status:', res.status);

  console.log('\n3. Recreating create_user_admin with correct extensions schema prefixes...');
  const createUserAdminSQL = `
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
  `;

  res = await execSQL(createUserAdminSQL);
  console.log('create_user_admin Creation Status:', res.status);
  console.log('create_user_admin Creation Response:', res.body);

  console.log('\n4. Recreating update_user_profile...');
  const updateUserProfileSQL = `
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
  `;

  res = await execSQL(updateUserProfileSQL);
  console.log('update_user_profile Creation Status:', res.status);
  console.log('update_user_profile Creation Response:', res.body);

  console.log('\n5. Recreating admin_reset_user_password...');
  const adminResetUserPasswordSQL = `
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
  `;

  res = await execSQL(adminResetUserPasswordSQL);
  console.log('admin_reset_user_password Creation Status:', res.status);
  console.log('admin_reset_user_password Response:', res.body);

  console.log('\n5.5 Recreating create_admin_user_for_company_safe...');
  const createAdminUserForCompanySafeSQL = `
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
  `;

  res = await execSQL(createAdminUserForCompanySafeSQL);
  console.log('create_admin_user_for_company_safe Creation Status:', res.status);
  console.log('create_admin_user_for_company_safe Response:', res.body);

  console.log('\n6. Granting execute permissions...');
  await execSQL(`GRANT EXECUTE ON FUNCTION public.create_user_admin(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, UUID, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN, JSONB, JSONB, DATE, UUID, UUID, BOOLEAN) TO authenticated, service_role;`);
  await execSQL(`GRANT EXECUTE ON FUNCTION public.update_user_profile(UUID, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN, JSONB, JSONB, UUID, UUID, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated, service_role;`);
  await execSQL(`GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO authenticated, service_role;`);
  await execSQL(`GRANT EXECUTE ON FUNCTION public.create_admin_user_for_company_safe(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;`);

  console.log('\n7. Reloading schema cache...');
  await execSQL(`NOTIFY pgrst, 'reload schema';`);
  console.log('Done!');
}

run().catch(console.error);
