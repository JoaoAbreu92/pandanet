-- ============================================================
-- ETAPA 08
-- STORAGE QUOTA - SERVICE ROLE / BACKEND
--
-- Objetivo:
-- 1. pre-check para uploads feitos por backend service_role;
-- 2. enforcement real por trigger em storage.objects;
-- 3. serializacao por empresa para reduzir race condition.
-- ============================================================


-- ============================================================
-- 1. PRE-CHECK EXCLUSIVO DO SERVICE ROLE
-- ============================================================

CREATE OR REPLACE FUNCTION
public.authorize_service_storage_upload(
    p_company_id uuid,
    p_bucket text,
    p_name text,
    p_size bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
    v_resolved_company uuid;
    v_used bigint;
    v_limit bigint;
    v_quota jsonb;
    v_allowed boolean;
BEGIN

    IF COALESCE(auth.role(), '') <> 'service_role'
    THEN
        RAISE EXCEPTION
            'Permissao negada: RPC exclusiva do service_role';
    END IF;


    IF p_company_id IS NULL THEN
        RAISE EXCEPTION
            'company_id obrigatorio';
    END IF;


    IF NOT EXISTS (
        SELECT 1
        FROM public.companies
        WHERE id = p_company_id
    ) THEN
        RAISE EXCEPTION
            'Empresa informada nao existe';
    END IF;


    IF NULLIF(btrim(p_bucket), '') IS NULL
       OR NULLIF(btrim(p_name), '') IS NULL
    THEN
        RAISE EXCEPTION
            'Bucket e path obrigatorios';
    END IF;


    IF COALESCE(p_size, 0) <= 0 THEN
        RAISE EXCEPTION
            'Tamanho do arquivo invalido';
    END IF;


    -- O path precisa resolver para exatamente a empresa
    -- que o backend informou.
    v_resolved_company :=
        public.resolve_storage_object_company(
            p_bucket,
            p_name,
            NULL
        );


    IF v_resolved_company IS NULL THEN
        RAISE EXCEPTION
            'Nao foi possivel atribuir o upload a uma empresa';
    END IF;


    IF v_resolved_company <> p_company_id THEN
        RAISE EXCEPTION
            'Empresa do path diverge da empresa informada';
    END IF;


    v_used :=
        public.get_company_storage_used_bytes(
            p_company_id
        );


    v_quota :=
        public.get_company_storage_quota_internal(
            p_company_id
        );


    v_limit :=
        COALESCE(
            NULLIF(
                v_quota ->> 'limit_bytes',
                ''
            )::bigint,
            0
        );


    IF v_limit <= 0 THEN
        RAISE EXCEPTION
            'Limite comercial de armazenamento invalido';
    END IF;


    v_allowed :=
        (v_used + p_size) <= v_limit;


    RETURN jsonb_build_object(
        'allowed', v_allowed,
        'company_id', p_company_id,
        'used_bytes', v_used,
        'limit_bytes', v_limit,
        'requested_bytes', p_size,
        'remaining_bytes',
            GREATEST(
                v_limit - v_used,
                0
            ),
        'reason',
            CASE
                WHEN v_allowed
                    THEN 'within_quota'
                ELSE 'quota_exceeded'
            END
    );

END;
$$;


REVOKE ALL
ON FUNCTION public.authorize_service_storage_upload(
    uuid,
    text,
    text,
    bigint
)
FROM PUBLIC, anon, authenticated;


GRANT EXECUTE
ON FUNCTION public.authorize_service_storage_upload(
    uuid,
    text,
    text,
    bigint
)
TO service_role;



-- ============================================================
-- 2. TRIGGER REAL DE QUOTA
--
-- RLS nao protege service_role.
-- Trigger protege porque continua sendo executado.
-- ============================================================

CREATE OR REPLACE FUNCTION
public.enforce_storage_company_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
    v_company_id uuid;
    v_old_company_id uuid;

    v_used bigint;
    v_limit bigint;

    v_new_size bigint;
    v_old_size bigint := 0;

    v_quota jsonb;
BEGIN

    -- --------------------------------------------------------
    -- Descobrir empresa do NOVO objeto.
    -- Objetos globais como system/main_logo.png permanecem
    -- fora da quota quando nao possuem empresa resolvivel.
    -- --------------------------------------------------------

    v_company_id :=
        public.resolve_storage_object_company(
            NEW.bucket_id,
            NEW.name,
            NEW.owner_id
        );


    IF v_company_id IS NULL THEN
        RETURN NEW;
    END IF;


    -- --------------------------------------------------------
    -- Serializa alteracoes de storage da mesma empresa.
    -- O lock dura ate o COMMIT da transacao do Storage API.
    -- --------------------------------------------------------

    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            v_company_id::text,
            0
        )
    );


    -- --------------------------------------------------------
    -- Tamanho do novo objeto.
    -- --------------------------------------------------------

    v_new_size :=
        CASE
            WHEN COALESCE(
                NEW.metadata,
                '{}'::jsonb
            ) ? 'size'
            AND COALESCE(
                NEW.metadata ->> 'size',
                ''
            ) ~ '^[0-9]+$'
            THEN
                (NEW.metadata ->> 'size')::bigint
            ELSE
                0
        END;


    IF v_new_size <= 0 THEN
        RAISE EXCEPTION
            'Storage bloqueado: objeto empresarial sem tamanho valido';
    END IF;


    -- --------------------------------------------------------
    -- Uso atual.
    -- --------------------------------------------------------

    v_used :=
        public.get_company_storage_used_bytes(
            v_company_id
        );


    -- --------------------------------------------------------
    -- Em UPDATE/UPSERT, retirar o tamanho antigo do calculo
    -- se continuamos na mesma empresa.
    -- --------------------------------------------------------

    IF TG_OP = 'UPDATE' THEN

        v_old_company_id :=
            public.resolve_storage_object_company(
                OLD.bucket_id,
                OLD.name,
                OLD.owner_id
            );


        IF v_old_company_id = v_company_id THEN

            v_old_size :=
                CASE
                    WHEN COALESCE(
                        OLD.metadata,
                        '{}'::jsonb
                    ) ? 'size'
                    AND COALESCE(
                        OLD.metadata ->> 'size',
                        ''
                    ) ~ '^[0-9]+$'
                    THEN
                        (OLD.metadata ->> 'size')::bigint
                    ELSE
                        0
                END;


            v_used :=
                GREATEST(
                    v_used - v_old_size,
                    0
                );

        END IF;

    END IF;


    -- --------------------------------------------------------
    -- Limite comercial.
    -- --------------------------------------------------------

    v_quota :=
        public.get_company_storage_quota_internal(
            v_company_id
        );


    v_limit :=
        COALESCE(
            NULLIF(
                v_quota ->> 'limit_bytes',
                ''
            )::bigint,
            0
        );


    IF v_limit <= 0 THEN
        RAISE EXCEPTION
            'Storage bloqueado: limite comercial invalido';
    END IF;


    -- --------------------------------------------------------
    -- Enforcement.
    -- --------------------------------------------------------

    IF (v_used + v_new_size) > v_limit THEN

        RAISE EXCEPTION
            'Storage quota exceeded for company %',
            v_company_id;

    END IF;


    RETURN NEW;

END;
$$;


REVOKE ALL
ON FUNCTION public.enforce_storage_company_quota()
FROM PUBLIC, anon, authenticated;


-- Trigger functions nao precisam EXECUTE direto pelos clientes.


DROP TRIGGER IF EXISTS
tr_enforce_storage_company_quota
ON storage.objects;


CREATE TRIGGER
tr_enforce_storage_company_quota
BEFORE INSERT OR UPDATE OF
    bucket_id,
    name,
    metadata,
    owner_id
ON storage.objects
FOR EACH ROW
EXECUTE FUNCTION
public.enforce_storage_company_quota();
