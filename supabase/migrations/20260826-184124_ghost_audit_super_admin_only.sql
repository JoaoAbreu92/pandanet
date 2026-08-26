-- ============================================================
-- ETAPA 08
-- GHOST AUDIT
-- SOMENTE SUPER ADMIN REAL
-- ============================================================


-- ============================================================
-- 1. AUTORIZACAO ESPECIFICA DO GHOST
--
-- Importante:
-- nao basta ser Company Admin;
-- nao basta estar impersonando Super Admin;
-- o JWT real precisa pertencer a profile Super Admin.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_ghost_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'Super Admin'
          AND COALESCE(p.status, 'active') = 'active'
    );
$$;


REVOKE ALL
ON FUNCTION public.is_ghost_super_admin()
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.is_ghost_super_admin()
TO authenticated, service_role;



-- ============================================================
-- 2. INICIAR AUDITORIA GHOST
--
-- NAO:
-- - cria notification
-- - altera profile
-- - altera empresa
-- - cria announcement
-- - registra presence
--
-- Apenas gera log PRIVADO em saas_admin_audit_log.
-- ============================================================

CREATE OR REPLACE FUNCTION public.begin_ghost_audit(
    target_company_id uuid,
    target_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_company_name text;
    v_target_email text;
BEGIN

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION
            'Usuario nao autenticado';
    END IF;


    IF NOT public.is_ghost_super_admin() THEN
        RAISE EXCEPTION
            'Modo Ghost exclusivo do Super Admin';
    END IF;


    IF target_company_id IS NULL THEN
        RAISE EXCEPTION
            'Empresa alvo invalida';
    END IF;


    SELECT c.name
    INTO v_company_name
    FROM public.companies c
    WHERE c.id = target_company_id;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Empresa alvo nao encontrada';
    END IF;


    IF target_user_id IS NOT NULL THEN

        SELECT p.email
        INTO v_target_email
        FROM public.profiles p
        WHERE p.id = target_user_id
          AND p.company_id = target_company_id;


        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Usuario alvo nao pertence a empresa informada';

        END IF;

    END IF;


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
        'ghost.audit_start',
        CASE
            WHEN target_user_id IS NULL
                THEN 'company'
            ELSE 'profile'
        END,
        COALESCE(
            target_user_id,
            target_company_id
        ),
        target_company_id,
        jsonb_build_object(
            'company_name',
            v_company_name,

            'target_user_id',
            target_user_id,

            'target_email',
            v_target_email,

            'silent',
            true,

            'authority',
            'Super Admin',

            'started_at',
            now()
        )
    );


    RETURN jsonb_build_object(
        'success',
        true,

        'authorized',
        true,

        'company_id',
        target_company_id,

        'target_user_id',
        target_user_id
    );

END;
$$;


REVOKE ALL
ON FUNCTION public.begin_ghost_audit(uuid, uuid)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.begin_ghost_audit(uuid, uuid)
TO authenticated, service_role;



-- ============================================================
-- 3. FINALIZAR AUDITORIA
-- ============================================================

CREATE OR REPLACE FUNCTION public.end_ghost_audit(
    target_company_id uuid,
    target_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION
            'Usuario nao autenticado';
    END IF;


    IF NOT public.is_ghost_super_admin() THEN
        RAISE EXCEPTION
            'Modo Ghost exclusivo do Super Admin';
    END IF;


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
        'ghost.audit_end',
        CASE
            WHEN target_user_id IS NULL
                THEN 'company'
            ELSE 'profile'
        END,
        COALESCE(
            target_user_id,
            target_company_id
        ),
        target_company_id,
        jsonb_build_object(
            'target_user_id',
            target_user_id,

            'silent',
            true,

            'ended_at',
            now()
        )
    );


    RETURN jsonb_build_object(
        'success',
        true
    );

END;
$$;


REVOKE ALL
ON FUNCTION public.end_ghost_audit(uuid, uuid)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.end_ghost_audit(uuid, uuid)
TO authenticated, service_role;



-- ============================================================
-- 4. LOG DO GHOST CONTINUA PRIVADO
-- ============================================================

DROP POLICY IF EXISTS
ghost_audit_log_private_select
ON public.saas_admin_audit_log;


CREATE POLICY ghost_audit_log_private_select
ON public.saas_admin_audit_log
FOR SELECT
TO authenticated
USING (
    public.is_ghost_super_admin()
);
