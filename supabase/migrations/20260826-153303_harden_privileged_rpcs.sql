-- ============================================================
-- 1. UPDATE DE PERFIL/HIERARQUIA DEVE RESPEITAR RLS
-- ============================================================

ALTER FUNCTION public.update_user_profile(
UUID, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, TEXT,
TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN,
JSONB, JSONB, UUID, UUID, BOOLEAN, BOOLEAN, BOOLEAN
) SECURITY INVOKER;

ALTER FUNCTION public.update_user_hierarchy(
UUID, UUID, UUID, BOOLEAN
) SECURITY INVOKER;


-- ============================================================
-- 2. CREATE ADMIN USER FOR COMPANY
--    Guardar implementação atual como função interna
-- ============================================================

ALTER FUNCTION public.create_admin_user_for_company_safe(
UUID, TEXT, TEXT, TEXT
) RENAME TO create_admin_user_for_company_internal;

REVOKE ALL ON FUNCTION public.create_admin_user_for_company_internal(
UUID, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.create_admin_user_for_company_safe(
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
BEGIN
    IF COALESCE(auth.role(), '') <> 'service_role'
       AND NOT COALESCE(public.is_platform_admin(), false) THEN
        RAISE EXCEPTION 'Permissao negada: apenas Platform Admin';
    END IF;

    RETURN public.create_admin_user_for_company_internal(
        p_company_id,
        p_admin_email,
        p_admin_password,
        p_admin_name
    );
END;
$$;


-- ============================================================
-- 3. CREATE COMPANY WITH ADMIN
-- ============================================================

ALTER FUNCTION public.create_company_with_admin_safe(
TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT
) RENAME TO create_company_with_admin_internal;

REVOKE ALL ON FUNCTION public.create_company_with_admin_internal(
TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.create_company_with_admin_safe(
    p_company_name text,
    p_company_domain text,
    p_company_cnpj text DEFAULT '',
    p_plan_id uuid DEFAULT NULL,
    p_admin_email text DEFAULT '',
    p_admin_password text DEFAULT '',
    p_admin_name text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $$
BEGIN
    IF COALESCE(auth.role(), '') <> 'service_role'
       AND NOT COALESCE(public.is_platform_admin(), false) THEN
        RAISE EXCEPTION 'Permissao negada: apenas Platform Admin';
    END IF;

    RETURN public.create_company_with_admin_internal(
        p_company_name,
        p_company_domain,
        p_company_cnpj,
        p_plan_id,
        p_admin_email,
        p_admin_password,
        p_admin_name
    );
END;
$$;


-- ============================================================
-- 4. APPROVE USER / CREATE COMPANY
-- ============================================================

ALTER FUNCTION public.approve_user_and_create_company(
UUID, UUID
) RENAME TO approve_user_and_create_company_internal;

REVOKE ALL ON FUNCTION public.approve_user_and_create_company_internal(
UUID, UUID
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.approve_user_and_create_company(
    p_user_id uuid,
    p_plan_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
BEGIN
    IF COALESCE(auth.role(), '') <> 'service_role'
       AND NOT COALESCE(public.is_platform_admin(), false) THEN
        RAISE EXCEPTION 'Permissao negada: apenas Platform Admin';
    END IF;

    RETURN public.approve_user_and_create_company_internal(
        p_user_id,
        p_plan_id
    );
END;
$$;


-- ============================================================
-- 5. GRANTS SOMENTE NAS FUNÇÕES PÚBLICAS PROTEGIDAS
-- ============================================================

REVOKE ALL ON FUNCTION public.create_admin_user_for_company_safe(
UUID, TEXT, TEXT, TEXT
) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.create_company_with_admin_safe(
TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT
) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.approve_user_and_create_company(
UUID, UUID
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_admin_user_for_company_safe(
UUID, TEXT, TEXT, TEXT
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.create_company_with_admin_safe(
TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.approve_user_and_create_company(
UUID, UUID
) TO authenticated, service_role;
