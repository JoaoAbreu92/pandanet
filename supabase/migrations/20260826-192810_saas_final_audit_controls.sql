-- ============================================================
-- ETAPA 08
-- PAINEL SAAS - CONTROLES FINAIS
-- ============================================================


-- ============================================================
-- 1. REJEITAR USUARIO
-- ============================================================

CREATE OR REPLACE FUNCTION public.reject_user_admin(
    target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_status text;
    v_role text;
    v_email text;
    v_company_id uuid;
BEGIN

    IF COALESCE(auth.role(), '') <> 'service_role'
       AND NOT COALESCE(public.is_platform_admin(), false)
    THEN
        RAISE EXCEPTION
            'Permissao negada: apenas Platform Admin';
    END IF;


    SELECT
        status,
        role,
        email,
        company_id
    INTO
        v_status,
        v_role,
        v_email,
        v_company_id
    FROM public.profiles
    WHERE id = target_user_id;


    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario nao encontrado';
    END IF;


    IF v_role IN (
        'Super Admin',
        'Master Admin'
    ) THEN
        RAISE EXCEPTION
            'Nao e permitido rejeitar Platform Admin';
    END IF;


    UPDATE public.profiles
    SET
        status = 'rejected',
        updated_at = now()
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
        'user.reject',
        'profile',
        target_user_id,
        v_company_id,
        jsonb_build_object(
            'email', v_email,
            'previous_status', v_status,
            'new_status', 'rejected'
        )
    );


    RETURN jsonb_build_object(
        'success', true,
        'user_id', target_user_id
    );

END;
$$;


REVOKE ALL
ON FUNCTION public.reject_user_admin(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.reject_user_admin(uuid)
TO authenticated, service_role;



-- ============================================================
-- 2. APROVACAO / REATIVACAO COM AUDITORIA
-- ============================================================

CREATE OR REPLACE FUNCTION public.approve_user_and_create_company(
    p_user_id uuid,
    p_plan_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_result jsonb;
    v_previous_status text;
    v_email text;
    v_previous_company uuid;
    v_result_company uuid;
    v_action text;
BEGIN

    IF COALESCE(auth.role(), '') <> 'service_role'
       AND NOT COALESCE(public.is_platform_admin(), false)
    THEN
        RAISE EXCEPTION
            'Permissao negada: apenas Platform Admin';
    END IF;


    SELECT
        status,
        email,
        company_id
    INTO
        v_previous_status,
        v_email,
        v_previous_company
    FROM public.profiles
    WHERE id = p_user_id;


    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario nao encontrado';
    END IF;


    v_result :=
        public.approve_user_and_create_company_internal(
            p_user_id,
            p_plan_id
        );


    IF COALESCE(
        (v_result->>'success')::boolean,
        false
    ) THEN

        v_result_company :=
            NULLIF(
                v_result->>'company_id',
                ''
            )::uuid;


        v_action :=
            CASE
                WHEN v_previous_status = 'rejected'
                    THEN 'user.reactivate'
                ELSE 'user.approve'
            END;


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
            v_action,
            'profile',
            p_user_id,
            COALESCE(
                v_result_company,
                v_previous_company
            ),
            jsonb_build_object(
                'email', v_email,
                'previous_status', v_previous_status,
                'new_status', 'active',
                'created_new_company',
                    COALESCE(
                        (v_result->>'created_new')::boolean,
                        false
                    )
            )
        );

    END IF;


    RETURN v_result;

END;
$$;


REVOKE ALL
ON FUNCTION public.approve_user_and_create_company(uuid, uuid)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.approve_user_and_create_company(uuid, uuid)
TO authenticated, service_role;



-- ============================================================
-- 3. SALVAR CONFIGURACOES GLOBAIS
-- ============================================================

CREATE OR REPLACE FUNCTION public.save_system_settings_admin(
    p_updates jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_keys jsonb;
BEGIN

    IF COALESCE(auth.role(), '') <> 'service_role'
       AND NOT COALESCE(public.is_platform_admin(), false)
    THEN
        RAISE EXCEPTION
            'Permissao negada: apenas Platform Admin';
    END IF;


    IF p_updates IS NULL
       OR jsonb_typeof(p_updates) <> 'array'
    THEN
        RAISE EXCEPTION
            'Formato de configuracoes invalido';
    END IF;


    INSERT INTO public.system_settings (
        key,
        value
    )
    SELECT
        elem->>'key',
        elem->>'value'
    FROM jsonb_array_elements(p_updates) elem
    WHERE
        NULLIF(
            btrim(elem->>'key'),
            ''
        ) IS NOT NULL

    ON CONFLICT (key)
    DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = now();


    SELECT
        COALESCE(
            jsonb_agg(elem->>'key'),
            '[]'::jsonb
        )
    INTO v_keys
    FROM jsonb_array_elements(p_updates) elem;


    INSERT INTO public.saas_admin_audit_log (
        actor_user_id,
        action,
        entity_type,
        metadata
    )
    VALUES (
        auth.uid(),
        'system.settings_update',
        'system_settings',
        jsonb_build_object(
            'keys', v_keys
        )
    );


    RETURN jsonb_build_object(
        'success', true
    );

END;
$$;


REVOKE ALL
ON FUNCTION public.save_system_settings_admin(jsonb)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.save_system_settings_admin(jsonb)
TO authenticated, service_role;



-- ============================================================
-- 4. PUBLICAR ATUALIZACAO DO SISTEMA
-- ============================================================

CREATE OR REPLACE FUNCTION public.publish_system_update_admin(
    p_version text,
    p_description text,
    p_pdf_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid;
BEGIN

    IF COALESCE(auth.role(), '') <> 'service_role'
       AND NOT COALESCE(public.is_platform_admin(), false)
    THEN
        RAISE EXCEPTION
            'Permissao negada: apenas Platform Admin';
    END IF;


    IF NULLIF(btrim(p_version), '') IS NULL THEN
        RAISE EXCEPTION 'Versao obrigatoria';
    END IF;


    IF NULLIF(btrim(p_description), '') IS NULL THEN
        RAISE EXCEPTION 'Descricao obrigatoria';
    END IF;


    INSERT INTO public.system_updates (
        version,
        description,
        pdf_url,
        active
    )
    VALUES (
        btrim(p_version),
        btrim(p_description),
        NULLIF(btrim(p_pdf_url), ''),
        true
    )
    RETURNING id
    INTO v_id;


    INSERT INTO public.saas_admin_audit_log (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        metadata
    )
    VALUES (
        auth.uid(),
        'system.update_publish',
        'system_update',
        v_id,
        jsonb_build_object(
            'version', btrim(p_version)
        )
    );


    RETURN jsonb_build_object(
        'success', true,
        'id', v_id
    );

END;
$$;


REVOKE ALL
ON FUNCTION public.publish_system_update_admin(
    text,
    text,
    text
)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.publish_system_update_admin(
    text,
    text,
    text
)
TO authenticated, service_role;



-- ============================================================
-- 5. CRIAR VIDEO DO MANUAL
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_manual_video_admin(
    p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid;
BEGIN

    IF COALESCE(auth.role(), '') <> 'service_role'
       AND NOT COALESCE(public.is_platform_admin(), false)
    THEN
        RAISE EXCEPTION
            'Permissao negada: apenas Platform Admin';
    END IF;


    IF NULLIF(
        btrim(p_payload->>'title'),
        ''
    ) IS NULL THEN
        RAISE EXCEPTION 'Titulo obrigatorio';
    END IF;


    IF NULLIF(
        btrim(p_payload->>'url'),
        ''
    ) IS NULL THEN
        RAISE EXCEPTION 'URL obrigatoria';
    END IF;


    INSERT INTO public.manual_videos (
        company_id,
        title,
        url,
        thumbnail,
        duration,
        category,
        description
    )
    VALUES (
        NULL,
        btrim(p_payload->>'title'),
        btrim(p_payload->>'url'),
        NULLIF(
            btrim(p_payload->>'thumbnail'),
            ''
        ),
        NULLIF(
            btrim(p_payload->>'duration'),
            ''
        ),
        NULLIF(
            btrim(p_payload->>'category'),
            ''
        ),
        NULLIF(
            btrim(p_payload->>'description'),
            ''
        )
    )
    RETURNING id
    INTO v_id;


    INSERT INTO public.saas_admin_audit_log (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        metadata
    )
    VALUES (
        auth.uid(),
        'manual.video_create',
        'manual_video',
        v_id,
        jsonb_build_object(
            'title',
            btrim(p_payload->>'title')
        )
    );


    RETURN jsonb_build_object(
        'success', true,
        'id', v_id
    );

END;
$$;


REVOKE ALL
ON FUNCTION public.create_manual_video_admin(jsonb)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.create_manual_video_admin(jsonb)
TO authenticated, service_role;



-- ============================================================
-- 6. EXCLUIR VIDEO DO MANUAL
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_manual_video_admin(
    target_video_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_title text;
BEGIN

    IF COALESCE(auth.role(), '') <> 'service_role'
       AND NOT COALESCE(public.is_platform_admin(), false)
    THEN
        RAISE EXCEPTION
            'Permissao negada: apenas Platform Admin';
    END IF;


    SELECT title
    INTO v_title
    FROM public.manual_videos
    WHERE id = target_video_id;


    IF NOT FOUND THEN
        RAISE EXCEPTION 'Video nao encontrado';
    END IF;


    DELETE FROM public.manual_videos
    WHERE id = target_video_id;


    INSERT INTO public.saas_admin_audit_log (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        metadata
    )
    VALUES (
        auth.uid(),
        'manual.video_delete',
        'manual_video',
        target_video_id,
        jsonb_build_object(
            'title', v_title
        )
    );


    RETURN jsonb_build_object(
        'success', true,
        'id', target_video_id
    );

END;
$$;


REVOKE ALL
ON FUNCTION public.delete_manual_video_admin(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.delete_manual_video_admin(uuid)
TO authenticated, service_role;



-- ============================================================
-- 7. AUDITORIA DE EXCLUSAO DE EMPRESA
--
-- Trigger registra APENAS exclusoes realmente concluídas.
-- company_id fica NULL para o log sobreviver após DELETE.
-- ============================================================

CREATE OR REPLACE FUNCTION public.audit_company_delete_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

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
        'company.delete',
        'company',
        OLD.id,
        NULL,
        jsonb_build_object(
            'company_name', OLD.name,
            'domain', OLD.domain,
            'status', OLD.status
        )
    );


    RETURN OLD;

END;
$$;


DROP TRIGGER IF EXISTS
tr_audit_company_delete_admin
ON public.companies;


CREATE TRIGGER tr_audit_company_delete_admin
BEFORE DELETE
ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.audit_company_delete_admin();



-- ============================================================
-- 8. MANUAL VIDEOS
-- Somente Platform Admin altera.
-- Usuarios autenticados podem ler videos globais ou da empresa.
-- ============================================================

DROP POLICY IF EXISTS
tenant_isolation_policy
ON public.manual_videos;


DROP POLICY IF EXISTS
manual_videos_read_authenticated
ON public.manual_videos;


DROP POLICY IF EXISTS
manual_videos_platform_write
ON public.manual_videos;


CREATE POLICY manual_videos_read_authenticated
ON public.manual_videos
FOR SELECT
TO authenticated
USING (
    company_id IS NULL
    OR company_id = public.get_user_company_id()
    OR public.is_platform_admin()
);


CREATE POLICY manual_videos_platform_write
ON public.manual_videos
FOR ALL
TO authenticated
USING (
    public.is_platform_admin()
)
WITH CHECK (
    public.is_platform_admin()
);



-- ============================================================
-- 9. MARKETPLACE
-- Remover policy INSERT duplicada antiga.
-- A policy atual + policy RESTRICTIVE de quota permanecem.
-- ============================================================

DROP POLICY IF EXISTS
"Authenticated upload marketplace media"
ON storage.objects;
