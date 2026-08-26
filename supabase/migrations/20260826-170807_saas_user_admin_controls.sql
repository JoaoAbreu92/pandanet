-- ============================================================
-- ETAPA 08
-- CONTROLES ADMINISTRATIVOS DE USUARIOS DO PAINEL SAAS
-- ============================================================


-- ============================================================
-- 1. LOG DE AUDITORIA ADMINISTRATIVA
-- ============================================================

CREATE TABLE IF NOT EXISTS public.saas_admin_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),

    actor_user_id uuid,

    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    company_id uuid,

    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);


CREATE INDEX IF NOT EXISTS idx_saas_admin_audit_created_at
ON public.saas_admin_audit_log (created_at DESC);


CREATE INDEX IF NOT EXISTS idx_saas_admin_audit_company
ON public.saas_admin_audit_log (company_id, created_at DESC);


CREATE INDEX IF NOT EXISTS idx_saas_admin_audit_actor
ON public.saas_admin_audit_log (actor_user_id, created_at DESC);


ALTER TABLE public.saas_admin_audit_log
ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS saas_admin_audit_select_platform_admin
ON public.saas_admin_audit_log;


CREATE POLICY saas_admin_audit_select_platform_admin
ON public.saas_admin_audit_log
FOR SELECT
TO authenticated
USING (
    public.is_platform_admin()
);


REVOKE ALL
ON public.saas_admin_audit_log
FROM PUBLIC, anon, authenticated;


GRANT SELECT
ON public.saas_admin_audit_log
TO authenticated;


GRANT ALL
ON public.saas_admin_audit_log
TO service_role;



-- ============================================================
-- 2. CRIAR ADMINISTRADOR DA EMPRESA COM LIMITE DO PLANO
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_admin_user_for_company_safe(
    p_company_id uuid,
    p_admin_email text,
    p_admin_password text,
    p_admin_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $$
DECLARE
    v_email text;
    v_name text;

    v_plan_id uuid;
    v_user_limit integer;
    v_active_users integer;

    v_result jsonb;
    v_new_user_id uuid;

BEGIN

    -- --------------------------------------------------------
    -- Autorizacao
    -- --------------------------------------------------------

    IF COALESCE(auth.role(), '') <> 'service_role'
       AND NOT COALESCE(public.is_platform_admin(), false) THEN

        RAISE EXCEPTION
            'Permissao negada: apenas Platform Admin';

    END IF;


    -- --------------------------------------------------------
    -- Normalizacao
    -- --------------------------------------------------------

    v_email := lower(trim(COALESCE(p_admin_email, '')));
    v_name := trim(COALESCE(p_admin_name, ''));


    -- --------------------------------------------------------
    -- Validacao
    -- --------------------------------------------------------

    IF p_company_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Empresa invalida.'
        );
    END IF;


    IF v_name = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Informe o nome do usuario.'
        );
    END IF;


    IF v_email = ''
       OR v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN

        RETURN jsonb_build_object(
            'success', false,
            'error', 'Informe um e-mail valido.'
        );

    END IF;


    IF length(COALESCE(p_admin_password, '')) < 6 THEN

        RETURN jsonb_build_object(
            'success', false,
            'error', 'A senha deve ter pelo menos 6 caracteres.'
        );

    END IF;


    -- --------------------------------------------------------
    -- Empresa / Plano
    -- --------------------------------------------------------

    SELECT c.plan_id
    INTO v_plan_id
    FROM public.companies c
    WHERE c.id = p_company_id;


    IF NOT FOUND THEN

        RETURN jsonb_build_object(
            'success', false,
            'error', 'Empresa nao encontrada.'
        );

    END IF;


    IF v_plan_id IS NULL THEN

        RETURN jsonb_build_object(
            'success', false,
            'error', 'A empresa nao possui um plano configurado.'
        );

    END IF;


    SELECT p.user_limit
    INTO v_user_limit
    FROM public.plans p
    WHERE p.id = v_plan_id;


    IF NOT FOUND THEN

        RETURN jsonb_build_object(
            'success', false,
            'error', 'Plano da empresa nao encontrado.'
        );

    END IF;


    -- --------------------------------------------------------
    -- Limite de usuarios
    -- --------------------------------------------------------

    SELECT count(*)
    INTO v_active_users
    FROM public.profiles p
    WHERE p.company_id = p_company_id
      AND COALESCE(p.status, 'active') = 'active';


    IF v_user_limit IS NOT NULL
       AND v_user_limit > 0
       AND v_active_users >= v_user_limit THEN

        RETURN jsonb_build_object(
            'success', false,
            'error',
            format(
                'Limite de usuarios atingido. O plano permite %s usuarios ativos.',
                v_user_limit
            ),
            'active_users', v_active_users,
            'user_limit', v_user_limit
        );

    END IF;


    -- --------------------------------------------------------
    -- Criacao existente
    -- --------------------------------------------------------

    v_result :=
        public.create_admin_user_for_company_internal(
            p_company_id,
            v_email,
            p_admin_password,
            v_name
        );


    IF NOT COALESCE(
        (v_result ->> 'success')::boolean,
        false
    ) THEN
        RETURN v_result;
    END IF;


    v_new_user_id :=
        NULLIF(v_result ->> 'user_id', '')::uuid;


    -- --------------------------------------------------------
    -- Auditoria
    -- --------------------------------------------------------

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
        'user.create_company_admin',
        'profile',
        v_new_user_id,
        p_company_id,
        jsonb_build_object(
            'email', v_email,
            'name', v_name,
            'plan_user_limit', v_user_limit,
            'users_before', v_active_users
        )
    );


    RETURN
        v_result ||
        jsonb_build_object(
            'user_limit', v_user_limit,
            'users_before', v_active_users,
            'users_after', v_active_users + 1
        );

END;
$$;



-- ============================================================
-- 3. PROMOVER / REMOVER COMPANY ADMIN
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_company_admin_safe(
    target_user_id uuid,
    new_status boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE

    v_company_id uuid;
    v_current_status boolean;
    v_role text;
    v_other_admins integer;

BEGIN

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;


    IF NOT COALESCE(public.is_platform_admin(), false) THEN
        RAISE EXCEPTION
            'Somente Platform Admin pode executar esta operacao';
    END IF;


    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario invalido';
    END IF;


    SELECT
        p.company_id,
        COALESCE(p.is_company_admin, false),
        p.role
    INTO
        v_company_id,
        v_current_status,
        v_role
    FROM public.profiles p
    WHERE p.id = target_user_id;


    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario nao encontrado';
    END IF;


    IF v_company_id IS NULL THEN
        RAISE EXCEPTION
            'Usuario nao esta vinculado a uma empresa';
    END IF;


    IF v_role IN ('Super Admin', 'Master Admin') THEN
        RAISE EXCEPTION
            'Nao e permitido alterar esse privilegio em uma conta de plataforma';
    END IF;


    -- Nenhuma alteracao.
    IF v_current_status = new_status THEN

        RETURN jsonb_build_object(
            'success', true,
            'changed', false,
            'is_company_admin', new_status
        );

    END IF;


    -- --------------------------------------------------------
    -- Ultimo administrador
    -- --------------------------------------------------------

    IF v_current_status = true
       AND new_status = false THEN

        SELECT count(*)
        INTO v_other_admins
        FROM public.profiles p
        WHERE p.company_id = v_company_id
          AND p.id <> target_user_id
          AND COALESCE(p.is_company_admin, false) = true
          AND COALESCE(p.status, 'active') = 'active';


        IF v_other_admins = 0 THEN

            RAISE EXCEPTION
                'Nao e permitido remover o ultimo Administrador da Empresa';

        END IF;

    END IF;


    UPDATE public.profiles
    SET is_company_admin = new_status
    WHERE id = target_user_id;


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
            WHEN new_status
            THEN 'user.promote_company_admin'
            ELSE 'user.demote_company_admin'
        END,
        'profile',
        target_user_id,
        v_company_id,
        jsonb_build_object(
            'previous_status', v_current_status,
            'new_status', new_status
        )
    );


    RETURN jsonb_build_object(
        'success', true,
        'changed', true,
        'is_company_admin', new_status
    );

END;
$$;



-- ============================================================
-- 4. EXCLUSAO SEGURA EXCLUSIVA DO PAINEL SAAS
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_user_admin_safe(
    target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE

    v_company_id uuid;
    v_email text;
    v_name text;
    v_role text;
    v_is_company_admin boolean;

    v_other_admins integer;

BEGIN

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;


    IF NOT COALESCE(public.is_platform_admin(), false) THEN

        RAISE EXCEPTION
            'Somente Platform Admin pode excluir usuarios pelo painel SaaS';

    END IF;


    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario invalido';
    END IF;


    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION
            'Nao e permitido excluir o proprio usuario';
    END IF;


    SELECT
        p.company_id,
        p.email,
        p.full_name,
        p.role,
        COALESCE(p.is_company_admin, false)
    INTO
        v_company_id,
        v_email,
        v_name,
        v_role,
        v_is_company_admin
    FROM public.profiles p
    WHERE p.id = target_user_id;


    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario nao encontrado';
    END IF;


    IF v_company_id IS NULL THEN
        RAISE EXCEPTION
            'Usuario nao esta vinculado a uma empresa';
    END IF;


    IF v_role IN ('Super Admin', 'Master Admin') THEN

        RAISE EXCEPTION
            'Contas administrativas da plataforma nao podem ser excluidas por esta operacao';

    END IF;


    -- --------------------------------------------------------
    -- Ultimo administrador
    -- --------------------------------------------------------

    IF v_is_company_admin THEN

        SELECT count(*)
        INTO v_other_admins
        FROM public.profiles p
        WHERE p.company_id = v_company_id
          AND p.id <> target_user_id
          AND COALESCE(p.is_company_admin, false) = true
          AND COALESCE(p.status, 'active') = 'active';


        IF v_other_admins = 0 THEN

            RAISE EXCEPTION
                'Nao e permitido excluir o ultimo Administrador da Empresa';

        END IF;

    END IF;


    -- Usa a rotina existente somente depois das validacoes.
    PERFORM public.delete_user_admin(target_user_id);


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
        'user.delete',
        'profile',
        target_user_id,
        v_company_id,
        jsonb_build_object(
            'email', v_email,
            'name', v_name,
            'was_company_admin', v_is_company_admin
        )
    );


    RETURN jsonb_build_object(
        'success', true,
        'user_id', target_user_id,
        'company_id', v_company_id
    );

END;
$$;



-- ============================================================
-- 5. PRIVILEGIOS DAS RPCS
-- ============================================================

REVOKE ALL
ON FUNCTION public.create_admin_user_for_company_safe(
    uuid, text, text, text
)
FROM PUBLIC, anon;


REVOKE ALL
ON FUNCTION public.set_company_admin_safe(
    uuid, boolean
)
FROM PUBLIC, anon;


REVOKE ALL
ON FUNCTION public.delete_user_admin_safe(
    uuid
)
FROM PUBLIC, anon;


GRANT EXECUTE
ON FUNCTION public.create_admin_user_for_company_safe(
    uuid, text, text, text
)
TO authenticated, service_role;


GRANT EXECUTE
ON FUNCTION public.set_company_admin_safe(
    uuid, boolean
)
TO authenticated, service_role;


GRANT EXECUTE
ON FUNCTION public.delete_user_admin_safe(
    uuid
)
TO authenticated, service_role;
