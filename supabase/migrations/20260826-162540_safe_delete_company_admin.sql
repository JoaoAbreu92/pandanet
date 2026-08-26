-- ============================================================
-- ETAPA 08
-- EXCLUSAO SEGURA DE EMPRESAS
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_company_admin(
    target_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
    v_company_name text;
    v_actor_company uuid;
    v_dep record;
    v_count bigint;
BEGIN

    IF target_company_id IS NULL THEN
        RAISE EXCEPTION 'Empresa invalida';
    END IF;

    IF auth.role() <> 'service_role'
       AND auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;

    IF auth.role() <> 'service_role'
       AND NOT COALESCE(public.is_platform_admin(), false) THEN
        RAISE EXCEPTION 'Somente Platform Admin pode excluir empresas';
    END IF;

    SELECT name
    INTO v_company_name
    FROM public.companies
    WHERE id = target_company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Empresa nao encontrada';
    END IF;


    -- Nunca permitir que o Super Admin exclua a empresa
    -- à qual sua própria conta está vinculada.
    IF auth.role() <> 'service_role' THEN
        v_actor_company := public.get_user_company_id();

        IF v_actor_company IS NOT NULL
           AND v_actor_company = target_company_id THEN
            RAISE EXCEPTION
                'Nao e permitido excluir a empresa vinculada ao usuario atual';
        END IF;
    END IF;


    -- --------------------------------------------------------
    -- SEGURANCA:
    -- Qualquer dependencia bloqueia a exclusao.
    --
    -- Assim nenhuma empresa ativa pode ser apagada por engano
    -- e nenhum CASCADE pode destruir dados silenciosamente.
    -- --------------------------------------------------------

    FOR v_dep IN
        SELECT DISTINCT
            tc.table_schema,
            tc.table_name,
            kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.constraint_schema = kcu.constraint_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
         AND tc.constraint_schema = ccu.constraint_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_schema = 'public'
          AND ccu.table_name = 'companies'
    LOOP

        EXECUTE format(
            'SELECT count(*) FROM %I.%I WHERE %I = $1',
            v_dep.table_schema,
            v_dep.table_name,
            v_dep.column_name
        )
        INTO v_count
        USING target_company_id;

        IF v_count > 0 THEN
            RAISE EXCEPTION
                'Empresa possui dados vinculados em %.% (% registros). Desative a empresa em vez de exclui-la.',
                v_dep.table_schema,
                v_dep.table_name,
                v_count;
        END IF;

    END LOOP;


    DELETE FROM public.companies
    WHERE id = target_company_id;


    RETURN jsonb_build_object(
        'success', true,
        'company_id', target_company_id,
        'company_name', v_company_name
    );

END;
$$;


REVOKE ALL
ON FUNCTION public.delete_company_admin(uuid)
FROM PUBLIC, anon;


GRANT EXECUTE
ON FUNCTION public.delete_company_admin(uuid)
TO authenticated, service_role;
