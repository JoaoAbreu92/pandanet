-- ============================================================
-- ETAPA 08
-- GHOST AUDIT - LOG PRIVADO
-- ============================================================

-- Existem policies antigas de leitura do audit log para
-- Platform Admin. Como policies permissive sao combinadas
-- com OR, recriamos a leitura para garantir que eventos
-- ghost.* sejam visiveis SOMENTE ao Super Admin real.

DO $$
DECLARE
    r record;
BEGIN

    FOR r IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'saas_admin_audit_log'
          AND cmd = 'SELECT'
    LOOP

        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON public.saas_admin_audit_log',
            r.policyname
        );

    END LOOP;

END;
$$;


CREATE POLICY saas_admin_audit_select_secure
ON public.saas_admin_audit_log
FOR SELECT
TO authenticated
USING (
    CASE
        WHEN action LIKE 'ghost.%'
            THEN public.is_ghost_super_admin()
        ELSE public.is_platform_admin()
    END
);
