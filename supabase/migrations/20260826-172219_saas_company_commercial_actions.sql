-- ============================================================
-- ETAPA 08
-- ACOES COMERCIAIS SEGURAS DO PAINEL SAAS
-- ============================================================


-- ============================================================
-- 1. STATUS DA EMPRESA
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_company_status_admin(
    target_company_id uuid,
    new_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
    v_old_status text;
    v_name text;
    v_new_status text;
BEGIN

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;

    IF NOT COALESCE(public.is_platform_admin(), false) THEN
        RAISE EXCEPTION 'Somente Platform Admin pode alterar o status da empresa';
    END IF;

    IF target_company_id IS NULL THEN
        RAISE EXCEPTION 'Empresa invalida';
    END IF;

    v_new_status := lower(trim(COALESCE(new_status, '')));

    IF v_new_status NOT IN ('active', 'inactive') THEN
        RAISE EXCEPTION 'Status invalido. Use active ou inactive';
    END IF;

    SELECT
        c.status,
        c.name
    INTO
        v_old_status,
        v_name
    FROM public.companies c
    WHERE c.id = target_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Empresa nao encontrada';
    END IF;

    IF COALESCE(v_old_status, '') = v_new_status THEN
        RETURN jsonb_build_object(
            'success', true,
            'changed', false,
            'status', v_new_status
        );
    END IF;

    UPDATE public.companies
    SET status = v_new_status
    WHERE id = target_company_id;

    INSERT INTO public.saas_admin_audit_log (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        company_id,
        metadata
    )
    VALUES (
        auth.uid(),
        CASE
            WHEN v_new_status = 'inactive'
                THEN 'company.deactivate'
            ELSE 'company.reactivate'
        END,
        'company',
        target_company_id,
        target_company_id,
        jsonb_build_object(
            'company_name', v_name,
            'previous_status', v_old_status,
            'new_status', v_new_status
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'changed', true,
        'previous_status', v_old_status,
        'status', v_new_status
    );

END;
$$;


-- ============================================================
-- 2. ADICIONAR 30 DIAS
-- O CALCULO FICA NO SERVIDOR
-- ============================================================

CREATE OR REPLACE FUNCTION public.extend_company_subscription_admin(
    target_company_id uuid,
    days_to_add integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
    v_old_end timestamptz;
    v_base timestamptz;
    v_new_end timestamptz;
    v_name text;
BEGIN

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;

    IF NOT COALESCE(public.is_platform_admin(), false) THEN
        RAISE EXCEPTION 'Somente Platform Admin pode alterar a validade da empresa';
    END IF;

    IF target_company_id IS NULL THEN
        RAISE EXCEPTION 'Empresa invalida';
    END IF;

    IF days_to_add IS NULL
       OR days_to_add < 1
       OR days_to_add > 3650 THEN
        RAISE EXCEPTION 'Quantidade de dias invalida';
    END IF;

    SELECT
        c.subscription_end_date,
        c.name
    INTO
        v_old_end,
        v_name
    FROM public.companies c
    WHERE c.id = target_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Empresa nao encontrada';
    END IF;

    v_base :=
        CASE
            WHEN v_old_end IS NULL OR v_old_end < now()
                THEN now()
            ELSE v_old_end
        END;

    v_new_end :=
        v_base + make_interval(days => days_to_add);

    UPDATE public.companies
    SET subscription_end_date = v_new_end
    WHERE id = target_company_id;

    INSERT INTO public.saas_admin_audit_log (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        company_id,
        metadata
    )
    VALUES (
        auth.uid(),
        'company.extend_subscription',
        'company',
        target_company_id,
        target_company_id,
        jsonb_build_object(
            'company_name', v_name,
            'days_added', days_to_add,
            'previous_end_date', v_old_end,
            'new_end_date', v_new_end
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'days_added', days_to_add,
        'previous_end_date', v_old_end,
        'new_end_date', v_new_end
    );

END;
$$;


-- ============================================================
-- 3. EDITAR DADOS COMERCIAIS/CADASTRAIS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_company_admin(
    target_company_id uuid,
    p_name text,
    p_domain text,
    p_cnpj text,
    p_plan_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
    v_old public.companies%ROWTYPE;

    v_name text;
    v_domain text;
    v_cnpj text;
BEGIN

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;

    IF NOT COALESCE(public.is_platform_admin(), false) THEN
        RAISE EXCEPTION 'Somente Platform Admin pode editar dados comerciais da empresa';
    END IF;

    IF target_company_id IS NULL THEN
        RAISE EXCEPTION 'Empresa invalida';
    END IF;

    v_name := trim(COALESCE(p_name, ''));
    v_domain := lower(trim(COALESCE(p_domain, '')));
    v_cnpj := NULLIF(trim(COALESCE(p_cnpj, '')), '');

    IF v_name = '' THEN
        RAISE EXCEPTION 'Informe o nome da empresa';
    END IF;

    IF v_domain = '' THEN
        RAISE EXCEPTION 'Informe o dominio da empresa';
    END IF;

    -- domínio não deve conter protocolo, caminho ou espaço
    IF v_domain ~* '(^https?://|/|\s)' THEN
        RAISE EXCEPTION 'Informe somente o dominio, sem protocolo, caminho ou espacos';
    END IF;

    IF p_plan_id IS NULL THEN
        RAISE EXCEPTION 'Selecione um plano';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.plans p
        WHERE p.id = p_plan_id
    ) THEN
        RAISE EXCEPTION 'Plano nao encontrado';
    END IF;

    SELECT *
    INTO v_old
    FROM public.companies
    WHERE id = target_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Empresa nao encontrada';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.companies c
        WHERE lower(c.domain) = v_domain
          AND c.id <> target_company_id
    ) THEN
        RAISE EXCEPTION 'Este dominio ja esta sendo utilizado por outra empresa';
    END IF;

    UPDATE public.companies
    SET
        name = v_name,
        domain = v_domain,
        cnpj = v_cnpj,
        plan_id = p_plan_id,
        settings =
            jsonb_set(
                COALESCE(v_old.settings, '{}'::jsonb),
                '{companyName}',
                to_jsonb(v_name),
                true
            )
    WHERE id = target_company_id;

    INSERT INTO public.saas_admin_audit_log (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        company_id,
        metadata
    )
    VALUES (
        auth.uid(),
        'company.update',
        'company',
        target_company_id,
        target_company_id,
        jsonb_build_object(
            'previous',
            jsonb_build_object(
                'name', v_old.name,
                'domain', v_old.domain,
                'cnpj', v_old.cnpj,
                'plan_id', v_old.plan_id
            ),
            'new',
            jsonb_build_object(
                'name', v_name,
                'domain', v_domain,
                'cnpj', v_cnpj,
                'plan_id', p_plan_id
            )
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'company_id', target_company_id,
        'name', v_name,
        'domain', v_domain,
        'plan_id', p_plan_id
    );

END;
$$;


-- ============================================================
-- 4. MODULOS / CUSTOM FEATURES
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_company_features_admin(
    target_company_id uuid,
    new_features jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
    v_old_features jsonb;
    v_name text;
    v_new_features jsonb;
BEGIN

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;

    IF NOT COALESCE(public.is_platform_admin(), false) THEN
        RAISE EXCEPTION 'Somente Platform Admin pode alterar os modulos comerciais';
    END IF;

    IF target_company_id IS NULL THEN
        RAISE EXCEPTION 'Empresa invalida';
    END IF;

    IF new_features IS NULL
       OR jsonb_typeof(new_features) <> 'object' THEN
        RAISE EXCEPTION 'Configuracao de modulos invalida';
    END IF;

    SELECT
        COALESCE(c.custom_features, '{}'::jsonb),
        c.name
    INTO
        v_old_features,
        v_name
    FROM public.companies c
    WHERE c.id = target_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Empresa nao encontrada';
    END IF;

    v_new_features := new_features;

    IF v_old_features = v_new_features THEN
        RETURN jsonb_build_object(
            'success', true,
            'changed', false
        );
    END IF;

    UPDATE public.companies
    SET custom_features = v_new_features
    WHERE id = target_company_id;

    INSERT INTO public.saas_admin_audit_log (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        company_id,
        metadata
    )
    VALUES (
        auth.uid(),
        'company.update_modules',
        'company',
        target_company_id,
        target_company_id,
        jsonb_build_object(
            'company_name', v_name,
            'previous_features', v_old_features,
            'new_features', v_new_features
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'changed', true
    );

END;
$$;


-- ============================================================
-- 5. PRIVILEGIOS
-- ============================================================

REVOKE ALL
ON FUNCTION public.set_company_status_admin(uuid, text)
FROM PUBLIC, anon;

REVOKE ALL
ON FUNCTION public.extend_company_subscription_admin(uuid, integer)
FROM PUBLIC, anon;

REVOKE ALL
ON FUNCTION public.update_company_admin(uuid, text, text, text, uuid)
FROM PUBLIC, anon;

REVOKE ALL
ON FUNCTION public.update_company_features_admin(uuid, jsonb)
FROM PUBLIC, anon;


GRANT EXECUTE
ON FUNCTION public.set_company_status_admin(uuid, text)
TO authenticated, service_role;

GRANT EXECUTE
ON FUNCTION public.extend_company_subscription_admin(uuid, integer)
TO authenticated, service_role;

GRANT EXECUTE
ON FUNCTION public.update_company_admin(uuid, text, text, text, uuid)
TO authenticated, service_role;

GRANT EXECUTE
ON FUNCTION public.update_company_features_admin(uuid, jsonb)
TO authenticated, service_role;
