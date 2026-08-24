/**
 * apply_trigger_fix.js
 * Updates the handle_new_user_profile trigger function on VPS.
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
  console.log('=== Updating handle_new_user_profile trigger function on VPS ===');
  
  const sql = `
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
            v_is_company_admin -- Se for company admin, ganha is_admin = true para o menu admin
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
  `;

  const res = await execSQL(sql);
  console.log('Status:', res.status);
  console.log('Response:', res.body);
  
  // Reload schema
  await execSQL("NOTIFY pgrst, 'reload schema';");
  console.log('Schema reloaded!');
}

run().catch(console.error);
