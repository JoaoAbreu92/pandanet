-- ============================================================
-- ETAPA 08
-- PLANOS + AVISOS SAAS
-- ============================================================


-- ============================================================
-- 1. CRIAR PLANO
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_plan_admin(
    p_name text,
    p_user_limit integer,
    p_whatsapp_limit integer,
    p_email_limit integer,
    p_price numeric,
    p_features jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
    v_id uuid;
    v_name text;
BEGIN

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;

    IF NOT COALESCE(public.is_platform_admin(), false) THEN
        RAISE EXCEPTION 'Somente Platform Admin pode criar planos';
    END IF;

    v_name := trim(COALESCE(p_name, ''));

    IF v_name = '' THEN
        RAISE EXCEPTION 'Informe o nome do plano';
    END IF;

    IF COALESCE(p_user_limit, 0) < 1 THEN
        RAISE EXCEPTION 'Limite de usuarios deve ser maior que zero';
    END IF;

    IF COALESCE(p_whatsapp_limit, 0) < 0
       OR COALESCE(p_email_limit, 0) < 0
       OR COALESCE(p_price, 0) < 0 THEN
        RAISE EXCEPTION 'Limites e valor nao podem ser negativos';
    END IF;

    INSERT INTO public.plans (
        name,
        user_limit,
        whatsapp_limit,
        email_limit,
        price,
        features
    )
    VALUES (
        v_name,
        p_user_limit,
        COALESCE(p_whatsapp_limit, 0),
        COALESCE(p_email_limit, 0),
        COALESCE(p_price, 0),
        COALESCE(p_features, '{}'::jsonb)
    )
    RETURNING id INTO v_id;

    INSERT INTO public.saas_admin_audit_log (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        metadata
    )
    VALUES (
        auth.uid(),
        'plan.create',
        'plan',
        v_id,
        jsonb_build_object(
            'name', v_name,
            'user_limit', p_user_limit,
            'whatsapp_limit', p_whatsapp_limit,
            'email_limit', p_email_limit,
            'price', p_price
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'plan_id', v_id
    );

END;
$$;


-- ============================================================
-- 2. EDITAR PLANO
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_plan_admin(
    target_plan_id uuid,
    p_name text,
    p_user_limit integer,
    p_whatsapp_limit integer,
    p_email_limit integer,
    p_price numeric,
    p_features jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
    v_old public.plans%ROWTYPE;
    v_name text;
BEGIN

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;

    IF NOT COALESCE(public.is_platform_admin(), false) THEN
        RAISE EXCEPTION 'Somente Platform Admin pode editar planos';
    END IF;

    IF target_plan_id IS NULL THEN
        RAISE EXCEPTION 'Plano invalido';
    END IF;

    v_name := trim(COALESCE(p_name, ''));

    IF v_name = '' THEN
        RAISE EXCEPTION 'Informe o nome do plano';
    END IF;

    IF COALESCE(p_user_limit, 0) < 1 THEN
        RAISE EXCEPTION 'Limite de usuarios deve ser maior que zero';
    END IF;

    IF COALESCE(p_whatsapp_limit, 0) < 0
       OR COALESCE(p_email_limit, 0) < 0
       OR COALESCE(p_price, 0) < 0 THEN
        RAISE EXCEPTION 'Limites e valor nao podem ser negativos';
    END IF;

    SELECT *
    INTO v_old
    FROM public.plans
    WHERE id = target_plan_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Plano nao encontrado';
    END IF;

    UPDATE public.plans
    SET
        name = v_name,
        user_limit = p_user_limit,
        whatsapp_limit = COALESCE(p_whatsapp_limit, 0),
        email_limit = COALESCE(p_email_limit, 0),
        price = COALESCE(p_price, 0),
        features = COALESCE(p_features, '{}'::jsonb)
    WHERE id = target_plan_id;

    INSERT INTO public.saas_admin_audit_log (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        metadata
    )
    VALUES (
        auth.uid(),
        'plan.update',
        'plan',
        target_plan_id,
        jsonb_build_object(
            'previous',
            jsonb_build_object(
                'name', v_old.name,
                'user_limit', v_old.user_limit,
                'whatsapp_limit', v_old.whatsapp_limit,
                'email_limit', v_old.email_limit,
                'price', v_old.price
            ),
            'new',
            jsonb_build_object(
                'name', v_name,
                'user_limit', p_user_limit,
                'whatsapp_limit', p_whatsapp_limit,
                'email_limit', p_email_limit,
                'price', p_price
            )
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'plan_id', target_plan_id
    );

END;
$$;


-- ============================================================
-- 3. EXCLUIR PLANO SOMENTE SE NAO ESTIVER EM USO
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_plan_admin(
    target_plan_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
    v_name text;
    v_usage bigint;
BEGIN

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;

    IF NOT COALESCE(public.is_platform_admin(), false) THEN
        RAISE EXCEPTION 'Somente Platform Admin pode excluir planos';
    END IF;

    IF target_plan_id IS NULL THEN
        RAISE EXCEPTION 'Plano invalido';
    END IF;

    SELECT name
    INTO v_name
    FROM public.plans
    WHERE id = target_plan_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Plano nao encontrado';
    END IF;

    SELECT count(*)
    INTO v_usage
    FROM public.companies
    WHERE plan_id = target_plan_id;

    IF v_usage > 0 THEN
        RAISE EXCEPTION
            'Este plano esta sendo utilizado por % empresa(s). Altere o plano das empresas antes de excluir.',
            v_usage;
    END IF;

    DELETE FROM public.plans
    WHERE id = target_plan_id;

    INSERT INTO public.saas_admin_audit_log (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        metadata
    )
    VALUES (
        auth.uid(),
        'plan.delete',
        'plan',
        target_plan_id,
        jsonb_build_object(
            'name', v_name
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'plan_id', target_plan_id
    );

END;
$$;


-- ============================================================
-- 4. BROADCAST DE AVISO SAAS
-- target_company_ids:
-- NULL = todas as empresas ativas
-- ARRAY = somente empresas informadas (usado em testes seguros)
-- ============================================================

CREATE OR REPLACE FUNCTION public.broadcast_saas_announcement_admin(
    p_title text,
    p_summary text,
    p_category text DEFAULT 'Notícias da Empresa',
    target_company_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
    v_title text;
    v_summary text;
    v_category text;
    v_count integer;
BEGIN

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;

    IF NOT COALESCE(public.is_platform_admin(), false) THEN
        RAISE EXCEPTION 'Somente Platform Admin pode enviar avisos globais';
    END IF;

    v_title := trim(COALESCE(p_title, ''));
    v_summary := trim(COALESCE(p_summary, ''));
    v_category := trim(
        COALESCE(NULLIF(p_category, ''), 'Notícias da Empresa')
    );

    IF v_title = '' THEN
        RAISE EXCEPTION 'Informe o titulo do aviso';
    END IF;

    IF v_summary = '' THEN
        RAISE EXCEPTION 'Informe o conteudo do aviso';
    END IF;

    INSERT INTO public.announcements (
        company_id,
        title,
        summary,
        category,
        date
    )
    SELECT
        c.id,
        v_title,
        v_summary,
        v_category,
        now()
    FROM public.companies c
    WHERE c.status = 'active'
      AND (
          target_company_ids IS NULL
          OR c.id = ANY(target_company_ids)
      );

    GET DIAGNOSTICS v_count = ROW_COUNT;

    IF target_company_ids IS NOT NULL
       AND v_count <> cardinality(target_company_ids) THEN
        RAISE EXCEPTION
            'Uma ou mais empresas alvo nao existem ou nao estao ativas';
    END IF;

    INSERT INTO public.saas_admin_audit_log (
        actor_user_id,
        action,
        entity_type,
        metadata
    )
    VALUES (
        auth.uid(),
        'announcement.broadcast',
        'announcement',
        jsonb_build_object(
            'title', v_title,
            'category', v_category,
            'target_count', v_count
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'target_count', v_count
    );

END;
$$;


-- ============================================================
-- 5. RLS DE ANNOUNCEMENTS
-- REMOVER POLICIES ANTIGAS SOBREPOSTAS
-- ============================================================

DROP POLICY IF EXISTS "Manage announcements"
ON public.announcements;

DROP POLICY IF EXISTS "announcements_company_access"
ON public.announcements;

DROP POLICY IF EXISTS "tenant_isolation_policy"
ON public.announcements;

DROP POLICY IF EXISTS "Delete company announcements"
ON public.announcements;

DROP POLICY IF EXISTS "Insert company announcements"
ON public.announcements;

DROP POLICY IF EXISTS "View announcements"
ON public.announcements;

DROP POLICY IF EXISTS "View company announcements"
ON public.announcements;

DROP POLICY IF EXISTS "Update company announcements"
ON public.announcements;


CREATE POLICY announcements_select_secure
ON public.announcements
FOR SELECT
TO authenticated
USING (
    public.is_platform_admin()
    OR company_id = public.get_user_company_id()
);


CREATE POLICY announcements_insert_secure
ON public.announcements
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_platform_admin()
    OR (
        company_id = public.get_user_company_id()
        AND public.is_company_admin_v2(company_id)
    )
);


CREATE POLICY announcements_update_secure
ON public.announcements
FOR UPDATE
TO authenticated
USING (
    public.is_platform_admin()
    OR (
        company_id = public.get_user_company_id()
        AND public.is_company_admin_v2(company_id)
    )
)
WITH CHECK (
    public.is_platform_admin()
    OR (
        company_id = public.get_user_company_id()
        AND public.is_company_admin_v2(company_id)
    )
);


CREATE POLICY announcements_delete_secure
ON public.announcements
FOR DELETE
TO authenticated
USING (
    public.is_platform_admin()
    OR (
        company_id = public.get_user_company_id()
        AND public.is_company_admin_v2(company_id)
    )
);


-- ============================================================
-- 6. STORAGE announcements-media
-- PRESERVAR MARKETPLACE
-- ============================================================

DROP POLICY IF EXISTS "Authenticated Upload"
ON storage.objects;


CREATE POLICY storage_marketplace_media_upload_authenticated
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'marketplace-media'
);


CREATE POLICY storage_announcements_media_upload_admin
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'announcements-media'
    AND (
        public.is_platform_admin()
        OR public.is_company_admin_v2(
            public.get_user_company_id()
        )
    )
);


CREATE POLICY storage_announcements_media_update_admin
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'announcements-media'
    AND (
        public.is_platform_admin()
        OR public.is_company_admin_v2(
            public.get_user_company_id()
        )
    )
)
WITH CHECK (
    bucket_id = 'announcements-media'
    AND (
        public.is_platform_admin()
        OR public.is_company_admin_v2(
            public.get_user_company_id()
        )
    )
);


CREATE POLICY storage_announcements_media_delete_admin
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'announcements-media'
    AND (
        public.is_platform_admin()
        OR public.is_company_admin_v2(
            public.get_user_company_id()
        )
    )
);


CREATE POLICY storage_announcements_media_select
ON storage.objects
FOR SELECT
TO public
USING (
    bucket_id = 'announcements-media'
);


-- ============================================================
-- 7. GRANTS RPC
-- ============================================================

REVOKE ALL
ON FUNCTION public.create_plan_admin(
    text, integer, integer, integer, numeric, jsonb
)
FROM PUBLIC, anon;

REVOKE ALL
ON FUNCTION public.update_plan_admin(
    uuid, text, integer, integer, integer, numeric, jsonb
)
FROM PUBLIC, anon;

REVOKE ALL
ON FUNCTION public.delete_plan_admin(uuid)
FROM PUBLIC, anon;

REVOKE ALL
ON FUNCTION public.broadcast_saas_announcement_admin(
    text, text, text, uuid[]
)
FROM PUBLIC, anon;


GRANT EXECUTE
ON FUNCTION public.create_plan_admin(
    text, integer, integer, integer, numeric, jsonb
)
TO authenticated, service_role;

GRANT EXECUTE
ON FUNCTION public.update_plan_admin(
    uuid, text, integer, integer, integer, numeric, jsonb
)
TO authenticated, service_role;

GRANT EXECUTE
ON FUNCTION public.delete_plan_admin(uuid)
TO authenticated, service_role;

GRANT EXECUTE
ON FUNCTION public.broadcast_saas_announcement_admin(
    text, text, text, uuid[]
)
TO authenticated, service_role;
