-- ============================================================
-- UPDATE USER HIERARCHY
-- ============================================================

ALTER FUNCTION public.update_user_hierarchy(
UUID, UUID, UUID, BOOLEAN
) RENAME TO update_user_hierarchy_internal;

REVOKE ALL ON FUNCTION public.update_user_hierarchy_internal(
UUID, UUID, UUID, BOOLEAN
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.update_user_hierarchy(
    p_user_id uuid,
    p_reports_to uuid DEFAULT NULL,
    p_sector_manager_id uuid DEFAULT NULL,
    p_is_manager boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_target_company uuid;
BEGIN
    IF auth.uid() IS NULL
       AND COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Nao autenticado';
    END IF;

    SELECT company_id
      INTO v_target_company
      FROM public.profiles
     WHERE id = p_user_id;

    IF v_target_company IS NULL THEN
        RAISE EXCEPTION 'Usuario alvo nao encontrado';
    END IF;

    IF COALESCE(auth.role(), '') <> 'service_role'
       AND NOT COALESCE(public.is_platform_admin(), false)
       AND NOT COALESCE(public.is_company_admin_v2(v_target_company), false) THEN
        RAISE EXCEPTION 'Sem permissao para alterar hierarquia';
    END IF;

    PERFORM public.update_user_hierarchy_internal(
        p_user_id,
        p_reports_to,
        p_sector_manager_id,
        p_is_manager
    );
END;
$$;

REVOKE ALL ON FUNCTION public.update_user_hierarchy(
UUID, UUID, UUID, BOOLEAN
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.update_user_hierarchy(
UUID, UUID, UUID, BOOLEAN
) TO authenticated, service_role;


-- ============================================================
-- UPDATE USER PROFILE
-- ============================================================

ALTER FUNCTION public.update_user_profile(
UUID, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, TEXT,
TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN,
JSONB, JSONB, UUID, UUID, BOOLEAN, BOOLEAN, BOOLEAN
) RENAME TO update_user_profile_internal;

REVOKE ALL ON FUNCTION public.update_user_profile_internal(
UUID, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, TEXT,
TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN,
JSONB, JSONB, UUID, UUID, BOOLEAN, BOOLEAN, BOOLEAN
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.update_user_profile(
    p_user_id uuid,
    p_full_name text DEFAULT NULL,
    p_role text DEFAULT NULL,
    p_team text DEFAULT NULL,
    p_department_id uuid DEFAULT NULL,
    p_is_admin boolean DEFAULT false,
    p_is_company_admin boolean DEFAULT false,
    p_permissions jsonb DEFAULT '{}'::jsonb,
    p_avatar_url text DEFAULT NULL,
    p_rg text DEFAULT NULL,
    p_cpf text DEFAULT NULL,
    p_emergency_contact_name text DEFAULT NULL,
    p_emergency_contact_phone text DEFAULT NULL,
    p_health_insurance text DEFAULT NULL,
    p_blood_type text DEFAULT NULL,
    p_marital_status text DEFAULT NULL,
    p_education_level text DEFAULT NULL,
    p_can_nudge boolean DEFAULT true,
    p_nudge_cooldown integer DEFAULT 30,
    p_is_whatsapp_agent boolean DEFAULT false,
    p_whatspanda_permissions jsonb DEFAULT '{}'::jsonb,
    p_email_permissions jsonb DEFAULT '{}'::jsonb,
    p_reports_to uuid DEFAULT NULL,
    p_sector_manager_id uuid DEFAULT NULL,
    p_is_manager boolean DEFAULT false,
    p_clear_reports_to boolean DEFAULT false,
    p_clear_sector_manager boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_target_company uuid;
BEGIN
    IF auth.uid() IS NULL
       AND COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Nao autenticado';
    END IF;

    SELECT company_id
      INTO v_target_company
      FROM public.profiles
     WHERE id = p_user_id;

    IF v_target_company IS NULL THEN
        RAISE EXCEPTION 'Usuario alvo nao encontrado';
    END IF;

    IF COALESCE(auth.role(), '') <> 'service_role'
       AND NOT COALESCE(public.is_platform_admin(), false)
       AND NOT COALESCE(public.is_company_admin_v2(v_target_company), false) THEN
        RAISE EXCEPTION 'Sem permissao para atualizar usuario';
    END IF;

    PERFORM public.update_user_profile_internal(
        p_user_id,
        p_full_name,
        p_role,
        p_team,
        p_department_id,
        p_is_admin,
        p_is_company_admin,
        p_permissions,
        p_avatar_url,
        p_rg,
        p_cpf,
        p_emergency_contact_name,
        p_emergency_contact_phone,
        p_health_insurance,
        p_blood_type,
        p_marital_status,
        p_education_level,
        p_can_nudge,
        p_nudge_cooldown,
        p_is_whatsapp_agent,
        p_whatspanda_permissions,
        p_email_permissions,
        p_reports_to,
        p_sector_manager_id,
        p_is_manager,
        p_clear_reports_to,
        p_clear_sector_manager
    );
END;
$$;

REVOKE ALL ON FUNCTION public.update_user_profile(
UUID, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, TEXT,
TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN,
JSONB, JSONB, UUID, UUID, BOOLEAN, BOOLEAN, BOOLEAN
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.update_user_profile(
UUID, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, TEXT,
TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN,
JSONB, JSONB, UUID, UUID, BOOLEAN, BOOLEAN, BOOLEAN
) TO authenticated, service_role;
