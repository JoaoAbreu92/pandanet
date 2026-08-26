-- ============================================================
-- ETAPA 08
-- STORAGE QUOTA COMERCIAL
-- ============================================================


-- ============================================================
-- 1. LIMITES
-- ============================================================

ALTER TABLE public.plans
ADD COLUMN IF NOT EXISTS storage_limit_gb numeric(10,2);


UPDATE public.plans
SET storage_limit_gb = 10
WHERE storage_limit_gb IS NULL;


ALTER TABLE public.plans
ALTER COLUMN storage_limit_gb SET DEFAULT 10;


ALTER TABLE public.plans
ALTER COLUMN storage_limit_gb SET NOT NULL;


ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS storage_limit_override_gb numeric(10,2);


ALTER TABLE public.plans
DROP CONSTRAINT IF EXISTS plans_storage_limit_gb_check;


ALTER TABLE public.plans
ADD CONSTRAINT plans_storage_limit_gb_check
CHECK (
    storage_limit_gb > 0
    AND storage_limit_gb <= 102400
);


ALTER TABLE public.companies
DROP CONSTRAINT IF EXISTS companies_storage_limit_override_gb_check;


ALTER TABLE public.companies
ADD CONSTRAINT companies_storage_limit_override_gb_check
CHECK (
    storage_limit_override_gb IS NULL
    OR (
        storage_limit_override_gb > 0
        AND storage_limit_override_gb <= 102400
    )
);



-- ============================================================
-- 2. PROTEGER OVERRIDE CONTRA COMPANY ADMIN
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_company_storage_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN

    IF NEW.storage_limit_override_gb
       IS DISTINCT FROM
       OLD.storage_limit_override_gb
       AND NOT COALESCE(
           public.is_platform_admin(),
           false
       )
    THEN

        RAISE EXCEPTION
            'Somente Platform Admin pode alterar o limite de armazenamento';

    END IF;

    RETURN NEW;

END;
$$;


DROP TRIGGER IF EXISTS
tr_guard_company_storage_limit
ON public.companies;


CREATE TRIGGER tr_guard_company_storage_limit
BEFORE UPDATE OF storage_limit_override_gb
ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.guard_company_storage_limit();



-- ============================================================
-- 3. RESOLVER EMPRESA DE UM OBJETO
--
-- Ordem:
-- 1. company UUID presente no path
-- 2. owner_id -> profile -> company
-- 3. UUID no path -> profile
-- 4. UUID no path -> conversation
-- 5. WhatsPanda quando aplicavel
-- ============================================================

CREATE OR REPLACE FUNCTION public.resolve_storage_object_company(
    p_bucket text,
    p_name text,
    p_owner_id text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $$
DECLARE

    v_segment text;
    v_uuid uuid;
    v_company_id uuid;

BEGIN

    -- --------------------------------------------------------
    -- UUIDs existentes no caminho
    -- --------------------------------------------------------

    FOREACH v_segment IN ARRAY
        string_to_array(
            COALESCE(p_name, ''),
            '/'
        )
    LOOP

        IF v_segment ~*
           '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN

            v_uuid := v_segment::uuid;

            -- Company diretamente no path
            SELECT c.id
            INTO v_company_id
            FROM public.companies c
            WHERE c.id = v_uuid;

            IF v_company_id IS NOT NULL THEN
                RETURN v_company_id;
            END IF;

        END IF;

    END LOOP;


    -- --------------------------------------------------------
    -- Owner do objeto
    -- --------------------------------------------------------

    IF COALESCE(p_owner_id, '') ~*
       '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    THEN

        SELECT p.company_id
        INTO v_company_id
        FROM public.profiles p
        WHERE p.id = p_owner_id::uuid;

        IF v_company_id IS NOT NULL THEN
            RETURN v_company_id;
        END IF;

    END IF;


    -- --------------------------------------------------------
    -- UUID no path pode ser usuario, conversa ou canal
    -- --------------------------------------------------------

    FOREACH v_segment IN ARRAY
        string_to_array(
            COALESCE(p_name, ''),
            '/'
        )
    LOOP

        IF v_segment ~*
           '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN

            v_uuid := v_segment::uuid;


            -- Profile
            SELECT p.company_id
            INTO v_company_id
            FROM public.profiles p
            WHERE p.id = v_uuid;

            IF v_company_id IS NOT NULL THEN
                RETURN v_company_id;
            END IF;


            -- Conversa interna
            SELECT c.company_id
            INTO v_company_id
            FROM public.conversations c
            WHERE c.id = v_uuid;

            IF v_company_id IS NOT NULL THEN
                RETURN v_company_id;
            END IF;


            -- WhatsPanda channel, se existir
            IF to_regclass(
                'public.whatsapp_channels'
            ) IS NOT NULL THEN

                BEGIN

                    EXECUTE
                        'SELECT company_id
                           FROM public.whatsapp_channels
                          WHERE id = $1
                          LIMIT 1'
                    INTO v_company_id
                    USING v_uuid;

                    IF v_company_id IS NOT NULL THEN
                        RETURN v_company_id;
                    END IF;

                EXCEPTION
                    WHEN undefined_column THEN
                        NULL;
                END;

            END IF;


            -- WhatsPanda conversations, se UUID for conversa
            IF to_regclass(
                'public.whatsapp_conversations'
            ) IS NOT NULL THEN

                BEGIN

                    EXECUTE
                        'SELECT company_id
                           FROM public.whatsapp_conversations
                          WHERE id = $1
                          LIMIT 1'
                    INTO v_company_id
                    USING v_uuid;

                    IF v_company_id IS NOT NULL THEN
                        RETURN v_company_id;
                    END IF;

                EXCEPTION
                    WHEN undefined_column THEN
                        NULL;
                END;

            END IF;

        END IF;

    END LOOP;


    RETURN NULL;

END;
$$;



-- ============================================================
-- 4. USO REAL DA EMPRESA
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_company_storage_used_bytes(
    p_company_id uuid
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $$

    SELECT COALESCE(
        SUM(
            CASE
                WHEN o.metadata ? 'size'
                THEN COALESCE(
                    NULLIF(
                        o.metadata ->> 'size',
                        ''
                    )::bigint,
                    0
                )
                ELSE 0
            END
        ),
        0
    )::bigint

    FROM storage.objects o

    WHERE public.resolve_storage_object_company(
        o.bucket_id,
        o.name,
        o.owner_id
    ) = p_company_id;

$$;



-- ============================================================
-- 5. QUOTA INTERNA
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_company_storage_quota_internal(
    p_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE

    v_plan_limit numeric;
    v_override_limit numeric;
    v_effective_limit numeric;

    v_used_bytes bigint;
    v_limit_bytes numeric;
    v_remaining_bytes numeric;

    v_percentage numeric;

    v_status text;

BEGIN

    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'Empresa invalida';
    END IF;


    SELECT
        COALESCE(p.storage_limit_gb, 10),
        c.storage_limit_override_gb
    INTO
        v_plan_limit,
        v_override_limit
    FROM public.companies c
    LEFT JOIN public.plans p
           ON p.id = c.plan_id
    WHERE c.id = p_company_id;


    IF NOT FOUND THEN
        RAISE EXCEPTION 'Empresa nao encontrada';
    END IF;


    v_plan_limit :=
        COALESCE(
            v_plan_limit,
            10
        );


    v_effective_limit :=
        COALESCE(
            v_override_limit,
            v_plan_limit
        );


    v_used_bytes :=
        public.get_company_storage_used_bytes(
            p_company_id
        );


    v_limit_bytes :=
        v_effective_limit
        * 1024
        * 1024
        * 1024;


    v_remaining_bytes :=
        GREATEST(
            v_limit_bytes - v_used_bytes,
            0
        );


    IF v_limit_bytes > 0 THEN

        v_percentage :=
            ROUND(
                (
                    v_used_bytes::numeric
                    / v_limit_bytes
                ) * 100,
                2
            );

    ELSE
        v_percentage := 0;
    END IF;


    v_status :=
        CASE
            WHEN v_percentage >= 100
                THEN 'limit'
            WHEN v_percentage >= 90
                THEN 'critical'
            WHEN v_percentage >= 80
                THEN 'warning'
            ELSE 'normal'
        END;


    RETURN jsonb_build_object(

        'company_id',
        p_company_id,

        'plan_limit_gb',
        ROUND(v_plan_limit, 2),

        'override_limit_gb',
        CASE
            WHEN v_override_limit IS NULL
                THEN NULL
            ELSE ROUND(v_override_limit, 2)
        END,

        'effective_limit_gb',
        ROUND(v_effective_limit, 2),

        'used_bytes',
        v_used_bytes,

        'limit_bytes',
        v_limit_bytes::bigint,

        'remaining_bytes',
        v_remaining_bytes::bigint,

        'used_gb',
        ROUND(
            v_used_bytes::numeric
            / 1073741824,
            3
        ),

        'remaining_gb',
        ROUND(
            v_remaining_bytes
            / 1073741824,
            3
        ),

        'percentage',
        v_percentage,

        'status',
        v_status

    );

END;
$$;



-- ============================================================
-- 6. QUOTA PUBLICA SEGURA
-- Platform Admin: qualquer empresa
-- Usuario: somente propria empresa
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_company_storage_quota(
    p_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_my_company uuid;
BEGIN

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;


    IF COALESCE(
        public.is_platform_admin(),
        false
    ) THEN

        RETURN
            public.get_company_storage_quota_internal(
                p_company_id
            );

    END IF;


    v_my_company :=
        public.get_user_company_id();


    IF v_my_company IS NULL
       OR v_my_company IS DISTINCT FROM p_company_id
    THEN

        RAISE EXCEPTION
            'Sem permissao para consultar armazenamento desta empresa';

    END IF;


    RETURN
        public.get_company_storage_quota_internal(
            p_company_id
        );

END;
$$;



-- ============================================================
-- 7. QUOTA DO PROPRIO USUARIO
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_company_storage_quota()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_company_id uuid;
BEGIN

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;


    v_company_id :=
        public.get_user_company_id();


    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Usuario sem empresa';
    END IF;


    RETURN
        public.get_company_storage_quota_internal(
            v_company_id
        );

END;
$$;



-- ============================================================
-- 8. ALTERAR LIMITE DO PLANO
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_plan_storage_limit_admin(
    target_plan_id uuid,
    p_storage_limit_gb numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE

    v_old numeric;
    v_name text;

BEGIN

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;


    IF NOT COALESCE(
        public.is_platform_admin(),
        false
    ) THEN

        RAISE EXCEPTION
            'Somente Platform Admin pode alterar a quota do plano';

    END IF;


    IF target_plan_id IS NULL THEN
        RAISE EXCEPTION 'Plano invalido';
    END IF;


    IF p_storage_limit_gb IS NULL
       OR p_storage_limit_gb <= 0
       OR p_storage_limit_gb > 102400
    THEN

        RAISE EXCEPTION
            'Limite de armazenamento invalido';

    END IF;


    SELECT
        storage_limit_gb,
        name
    INTO
        v_old,
        v_name
    FROM public.plans
    WHERE id = target_plan_id
    FOR UPDATE;


    IF NOT FOUND THEN
        RAISE EXCEPTION 'Plano nao encontrado';
    END IF;


    IF v_old IS NOT DISTINCT FROM p_storage_limit_gb THEN

        RETURN jsonb_build_object(
            'success', true,
            'changed', false,
            'storage_limit_gb', p_storage_limit_gb
        );

    END IF;


    UPDATE public.plans
    SET storage_limit_gb = p_storage_limit_gb
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
        'plan.storage_limit_update',
        'plan',
        target_plan_id,
        jsonb_build_object(
            'plan_name', v_name,
            'previous_limit_gb', v_old,
            'new_limit_gb', p_storage_limit_gb
        )
    );


    RETURN jsonb_build_object(
        'success', true,
        'changed', true,
        'storage_limit_gb', p_storage_limit_gb
    );

END;
$$;



-- ============================================================
-- 9. OVERRIDE POR EMPRESA
-- NULL = VOLTA AO PLANO
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_company_storage_limit_admin(
    target_company_id uuid,
    p_override_limit_gb numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE

    v_old numeric;
    v_name text;
    v_plan_limit numeric;
    v_effective numeric;

BEGIN

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;


    IF NOT COALESCE(
        public.is_platform_admin(),
        false
    ) THEN

        RAISE EXCEPTION
            'Somente Platform Admin pode definir limite personalizado';

    END IF;


    IF target_company_id IS NULL THEN
        RAISE EXCEPTION 'Empresa invalida';
    END IF;


    IF p_override_limit_gb IS NOT NULL
       AND (
           p_override_limit_gb <= 0
           OR p_override_limit_gb > 102400
       )
    THEN

        RAISE EXCEPTION
            'Limite personalizado invalido';

    END IF;


    SELECT
        c.storage_limit_override_gb,
        c.name,
        COALESCE(p.storage_limit_gb, 10)
    INTO
        v_old,
        v_name,
        v_plan_limit
    FROM public.companies c
    LEFT JOIN public.plans p
           ON p.id = c.plan_id
    WHERE c.id = target_company_id
    FOR UPDATE OF c;


    IF NOT FOUND THEN
        RAISE EXCEPTION 'Empresa nao encontrada';
    END IF;


    UPDATE public.companies
    SET storage_limit_override_gb =
        p_override_limit_gb
    WHERE id = target_company_id;


    v_effective :=
        COALESCE(
            p_override_limit_gb,
            v_plan_limit
        );


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
            WHEN p_override_limit_gb IS NULL
                THEN 'company.storage_limit_reset'
            ELSE 'company.storage_limit_override'
        END,
        'company',
        target_company_id,
        target_company_id,
        jsonb_build_object(
            'company_name', v_name,
            'previous_override_gb', v_old,
            'new_override_gb', p_override_limit_gb,
            'plan_limit_gb', v_plan_limit,
            'effective_limit_gb', v_effective
        )
    );


    RETURN jsonb_build_object(
        'success', true,
        'override_limit_gb', p_override_limit_gb,
        'plan_limit_gb', v_plan_limit,
        'effective_limit_gb', v_effective
    );

END;
$$;



-- ============================================================
-- 10. SERVER-SIDE QUOTA PARA INSERT
-- Platform Admin nao entra na quota de cliente.
-- Usuario sem company_id nao e bloqueado aqui.
-- ============================================================

CREATE OR REPLACE FUNCTION public.storage_upload_within_quota(
    p_bucket text,
    p_name text,
    p_metadata jsonb,
    p_owner_id text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE

    v_company_id uuid;

    v_used bigint;
    v_limit bigint;

    v_new_size bigint;

BEGIN

    IF COALESCE(
        public.is_platform_admin(),
        false
    ) THEN
        RETURN true;
    END IF;


    v_company_id :=
        public.get_user_company_id();


    -- Cadastro sem empresa, avatar inicial etc.
    IF v_company_id IS NULL THEN
        RETURN true;
    END IF;


    v_new_size :=
        CASE
            WHEN COALESCE(
                p_metadata,
                '{}'::jsonb
            ) ? 'size'
            THEN COALESCE(
                NULLIF(
                    p_metadata ->> 'size',
                    ''
                )::bigint,
                0
            )
            ELSE 0
        END;


    -- Se Storage API nao forneceu tamanho,
    -- nao fazemos bloqueio cego.
    IF v_new_size <= 0 THEN
        RETURN true;
    END IF;


    SELECT
        (q ->> 'used_bytes')::bigint,
        (q ->> 'limit_bytes')::bigint
    INTO
        v_used,
        v_limit
    FROM (
        SELECT
            public.get_company_storage_quota_internal(
                v_company_id
            ) AS q
    ) s;


    RETURN
        (v_used + v_new_size) <= v_limit;

END;
$$;



-- ============================================================
-- 11. SERVER-SIDE QUOTA PARA UPDATE/UPSERT
-- ============================================================

CREATE OR REPLACE FUNCTION public.storage_update_within_quota(
    p_object_id uuid,
    p_bucket text,
    p_name text,
    p_metadata jsonb,
    p_owner_id text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $$
DECLARE

    v_company_id uuid;

    v_used bigint;
    v_limit bigint;

    v_old_size bigint := 0;
    v_new_size bigint := 0;

BEGIN

    IF COALESCE(
        public.is_platform_admin(),
        false
    ) THEN
        RETURN true;
    END IF;


    v_company_id :=
        public.get_user_company_id();


    IF v_company_id IS NULL THEN
        RETURN true;
    END IF;


    SELECT
        CASE
            WHEN COALESCE(
                o.metadata,
                '{}'::jsonb
            ) ? 'size'
            THEN COALESCE(
                NULLIF(
                    o.metadata ->> 'size',
                    ''
                )::bigint,
                0
            )
            ELSE 0
        END
    INTO v_old_size
    FROM storage.objects o
    WHERE o.id = p_object_id;


    v_old_size :=
        COALESCE(
            v_old_size,
            0
        );


    v_new_size :=
        CASE
            WHEN COALESCE(
                p_metadata,
                '{}'::jsonb
            ) ? 'size'
            THEN COALESCE(
                NULLIF(
                    p_metadata ->> 'size',
                    ''
                )::bigint,
                0
            )
            ELSE 0
        END;


    IF v_new_size <= 0 THEN
        RETURN true;
    END IF;


    SELECT
        (q ->> 'used_bytes')::bigint,
        (q ->> 'limit_bytes')::bigint
    INTO
        v_used,
        v_limit
    FROM (
        SELECT
            public.get_company_storage_quota_internal(
                v_company_id
            ) AS q
    ) s;


    RETURN
        (
            GREATEST(
                v_used - v_old_size,
                0
            )
            + v_new_size
        ) <= v_limit;

END;
$$;



-- ============================================================
-- 12. RESTRICTIVE POLICIES
--
-- Estas policies NAO concedem upload.
-- Apenas restringem uploads que ja seriam permitidos.
-- ============================================================

DROP POLICY IF EXISTS
storage_company_quota_insert_guard
ON storage.objects;


CREATE POLICY storage_company_quota_insert_guard
ON storage.objects
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
    public.storage_upload_within_quota(
        bucket_id,
        name,
        metadata,
        owner_id
    )
);


DROP POLICY IF EXISTS
storage_company_quota_update_guard
ON storage.objects;


CREATE POLICY storage_company_quota_update_guard
ON storage.objects
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (
    public.storage_update_within_quota(
        id,
        bucket_id,
        name,
        metadata,
        owner_id
    )
);



-- ============================================================
-- 13. NOTIFICACOES AUTOMATICAS
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_storage_quota_alerts(
    p_company_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE

    v_quota jsonb;

    v_percentage numeric;
    v_used_gb numeric;
    v_limit_gb numeric;

    v_threshold integer;

    v_title text;
    v_description text;

BEGIN

    IF p_company_id IS NULL THEN
        RETURN;
    END IF;


    v_quota :=
        public.get_company_storage_quota_internal(
            p_company_id
        );


    v_percentage :=
        COALESCE(
            (v_quota ->> 'percentage')::numeric,
            0
        );


    v_used_gb :=
        COALESCE(
            (v_quota ->> 'used_gb')::numeric,
            0
        );


    v_limit_gb :=
        COALESCE(
            (v_quota ->> 'effective_limit_gb')::numeric,
            0
        );


    v_threshold :=
        CASE
            WHEN v_percentage >= 100 THEN 100
            WHEN v_percentage >= 90 THEN 90
            WHEN v_percentage >= 80 THEN 80
            ELSE NULL
        END;


    IF v_threshold IS NULL THEN
        RETURN;
    END IF;


    IF v_threshold = 100 THEN

        v_title :=
            'Limite de armazenamento atingido';

        v_description :=
            format(
                'Sua empresa utilizou %s GB do limite de %s GB. Novos uploads podem ser bloqueados ate que haja espaco disponivel ou o limite seja ampliado.',
                v_used_gb,
                v_limit_gb
            );

    ELSIF v_threshold = 90 THEN

        v_title :=
            'Armazenamento em nivel critico';

        v_description :=
            format(
                'Sua empresa ja utilizou %s GB de %s GB (%s%%).',
                v_used_gb,
                v_limit_gb,
                v_percentage
            );

    ELSE

        v_title :=
            'Armazenamento proximo do limite';

        v_description :=
            format(
                'Sua empresa ja utilizou %s GB de %s GB (%s%%).',
                v_used_gb,
                v_limit_gb,
                v_percentage
            );

    END IF;


    INSERT INTO public.notifications (
        user_id,
        company_id,
        type,
        title,
        description,
        is_read,
        metadata
    )

    SELECT
        p.id,
        p_company_id,
        'storage_quota',
        v_title,
        v_description,
        false,
        jsonb_build_object(
            'threshold',
            v_threshold,
            'percentage',
            v_percentage,
            'used_gb',
            v_used_gb,
            'limit_gb',
            v_limit_gb
        )

    FROM public.profiles p

    WHERE p.company_id = p_company_id

      AND COALESCE(
          p.status,
          'active'
      ) = 'active'

      AND (
          COALESCE(
              p.is_company_admin,
              false
          )
          OR COALESCE(
              p.is_admin,
              false
          )
      )

      AND NOT EXISTS (

          SELECT 1
          FROM public.notifications n

          WHERE n.user_id = p.id

            AND n.company_id = p_company_id

            AND n.type = 'storage_quota'

            AND COALESCE(
                n.metadata ->> 'threshold',
                ''
            ) = v_threshold::text

            AND n.created_at >
                now() - interval '7 days'

      );

END;
$$;



-- ============================================================
-- 14. TRIGGER APOS NOVO OBJETO
-- ============================================================

CREATE OR REPLACE FUNCTION public.storage_quota_after_object_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $$
DECLARE

    v_company_id uuid;

BEGIN

    v_company_id :=
        public.resolve_storage_object_company(
            NEW.bucket_id,
            NEW.name,
            NEW.owner_id
        );


    IF v_company_id IS NOT NULL THEN

        PERFORM
            public.create_storage_quota_alerts(
                v_company_id
            );

    END IF;


    RETURN NEW;

END;
$$;


DROP TRIGGER IF EXISTS
tr_storage_quota_after_object_insert
ON storage.objects;


CREATE TRIGGER tr_storage_quota_after_object_insert
AFTER INSERT
ON storage.objects
FOR EACH ROW
EXECUTE FUNCTION
public.storage_quota_after_object_insert();



-- ============================================================
-- 15. GRANTS
-- ============================================================

REVOKE ALL
ON FUNCTION public.get_company_storage_quota(uuid)
FROM PUBLIC, anon;


REVOKE ALL
ON FUNCTION public.get_my_company_storage_quota()
FROM PUBLIC, anon;


REVOKE ALL
ON FUNCTION public.set_plan_storage_limit_admin(uuid, numeric)
FROM PUBLIC, anon;


REVOKE ALL
ON FUNCTION public.set_company_storage_limit_admin(uuid, numeric)
FROM PUBLIC, anon;


GRANT EXECUTE
ON FUNCTION public.get_company_storage_quota(uuid)
TO authenticated, service_role;


GRANT EXECUTE
ON FUNCTION public.get_my_company_storage_quota()
TO authenticated, service_role;


GRANT EXECUTE
ON FUNCTION public.set_plan_storage_limit_admin(uuid, numeric)
TO authenticated, service_role;


GRANT EXECUTE
ON FUNCTION public.set_company_storage_limit_admin(uuid, numeric)
TO authenticated, service_role;
