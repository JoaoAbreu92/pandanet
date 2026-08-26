-- ============================================================
-- 1. TRIGGER delete_old_posts
-- Não deve ser RPC pública.
-- ============================================================

ALTER FUNCTION public.delete_old_posts()
SET search_path TO 'public';

REVOKE ALL ON FUNCTION public.delete_old_posts()
FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 2. SUPPORT CONVERSATION
-- Usuário só pode abrir conversa em seu próprio nome
-- e somente com Platform Admin.
-- ============================================================

ALTER FUNCTION public.get_or_create_support_conversation(
UUID, UUID
) RENAME TO get_or_create_support_conversation_internal;

REVOKE ALL ON FUNCTION public.get_or_create_support_conversation_internal(
UUID, UUID
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.get_or_create_support_conversation(
    admin_id uuid,
    master_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_master_is_platform_admin boolean;
BEGIN
    IF auth.uid() IS NULL
       AND COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Nao autenticado';
    END IF;

    IF COALESCE(auth.role(), '') <> 'service_role'
       AND auth.uid() IS DISTINCT FROM admin_id THEN
        RAISE EXCEPTION 'Usuario solicitante invalido';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = master_id
          AND role IN ('Super Admin', 'Master Admin')
    )
    INTO v_master_is_platform_admin;

    IF NOT COALESCE(v_master_is_platform_admin, false) THEN
        RAISE EXCEPTION 'Destino de suporte invalido';
    END IF;

    RETURN public.get_or_create_support_conversation_internal(
        admin_id,
        master_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_support_conversation(
UUID, UUID
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_or_create_support_conversation(
UUID, UUID
) TO authenticated, service_role;

-- ============================================================
-- 3. STORAGE STATS
-- Exclusivo do Platform Admin / service_role.
-- ============================================================

ALTER FUNCTION public.get_storage_stats(
UUID
) RENAME TO get_storage_stats_internal;

REVOKE ALL ON FUNCTION public.get_storage_stats_internal(
UUID
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.get_storage_stats(
    p_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF COALESCE(auth.role(), '') <> 'service_role'
       AND NOT COALESCE(public.is_platform_admin(), false) THEN
        RAISE EXCEPTION 'Permissao negada: apenas Platform Admin';
    END IF;

    RETURN public.get_storage_stats_internal(p_company_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_storage_stats(
UUID
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_storage_stats(
UUID
) TO authenticated, service_role;
