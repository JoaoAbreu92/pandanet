-- ETAPA 10
-- Enforcement transacional dos limites comerciais de usuários,
-- canais WhatsApp e contas de e-mail.
--
-- Regras:
-- - nenhuma empresa sem plano cria recursos comerciais;
-- - limites são aplicados no banco, inclusive contra chamadas REST diretas;
-- - updates do próprio registro não consomem uma nova vaga;
-- - Platform Admin autenticado mantém o bypass administrativo/Ghost;
-- - service_role não recebe bypass implícito;
-- - locks por empresa evitam ultrapassagem por concorrência.

CREATE OR REPLACE FUNCTION public.enforce_profile_plan_user_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
    v_limit integer;
    v_usage integer;
BEGIN
    -- Apenas perfis ativos consomem vaga.
    IF COALESCE(NEW.status, 'active') <> 'active'
       OR NEW.company_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- O Super Admin real pode ignorar o limite em ação administrativa/Ghost.
    IF auth.uid() IS NOT NULL
       AND COALESCE(public.is_platform_admin(), false) THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            'pandanet:user-limit:' || NEW.company_id::text,
            0
        )
    );

    SELECT p.user_limit
      INTO v_limit
      FROM public.companies c
      JOIN public.plans p ON p.id = c.plan_id
     WHERE c.id = NEW.company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'A empresa não possui um plano válido para criar ou ativar usuários.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT count(*)
      INTO v_usage
      FROM public.profiles pr
     WHERE pr.company_id = NEW.company_id
       AND COALESCE(pr.status, 'active') = 'active'
       AND pr.id IS DISTINCT FROM NEW.id;

    IF v_limit IS NULL OR v_limit < 1 OR v_usage >= v_limit THEN
        RAISE EXCEPTION
            'Limite de usuários do plano atingido (% de %).',
            v_usage,
            COALESCE(v_limit, 0)
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_enforce_profile_plan_user_limit
ON public.profiles;

CREATE TRIGGER tr_enforce_profile_plan_user_limit
BEFORE INSERT OR UPDATE OF company_id, status
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_plan_user_limit();


CREATE OR REPLACE FUNCTION public.enforce_whatsapp_plan_channel_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
    v_limit integer;
    v_usage integer;
BEGIN
    IF NEW.company_id IS NULL THEN
        RAISE EXCEPTION
            'Empresa obrigatória para criar canal.'
            USING ERRCODE = 'P0001';
    END IF;

    IF auth.uid() IS NOT NULL
       AND COALESCE(public.is_platform_admin(), false) THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            'pandanet:whatsapp-limit:' || NEW.company_id::text,
            0
        )
    );

    SELECT p.whatsapp_limit
      INTO v_limit
      FROM public.companies c
      JOIN public.plans p ON p.id = c.plan_id
     WHERE c.id = NEW.company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'A empresa não possui um plano válido para criar canais.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT count(*)
      INTO v_usage
      FROM public.whatsapp_settings ws
     WHERE ws.company_id = NEW.company_id
       AND ws.id IS DISTINCT FROM NEW.id;

    IF v_limit IS NULL OR v_limit < 1 OR v_usage >= v_limit THEN
        RAISE EXCEPTION
            'Limite de canais do plano atingido (% de %).',
            v_usage,
            COALESCE(v_limit, 0)
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_enforce_whatsapp_plan_channel_limit
ON public.whatsapp_settings;

CREATE TRIGGER tr_enforce_whatsapp_plan_channel_limit
BEFORE INSERT OR UPDATE OF company_id
ON public.whatsapp_settings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_whatsapp_plan_channel_limit();


CREATE OR REPLACE FUNCTION public.enforce_email_plan_account_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
    v_limit integer;
    v_usage integer;
BEGIN
    IF NEW.company_id IS NULL THEN
        RAISE EXCEPTION
            'Empresa obrigatória para criar conta de e-mail.'
            USING ERRCODE = 'P0001';
    END IF;

    IF auth.uid() IS NOT NULL
       AND COALESCE(public.is_platform_admin(), false) THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            'pandanet:email-limit:' || NEW.company_id::text,
            0
        )
    );

    SELECT p.email_limit
      INTO v_limit
      FROM public.companies c
      JOIN public.plans p ON p.id = c.plan_id
     WHERE c.id = NEW.company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'A empresa não possui um plano válido para criar contas de e-mail.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT count(*)
      INTO v_usage
      FROM public.email_settings es
     WHERE es.company_id = NEW.company_id
       AND es.id IS DISTINCT FROM NEW.id;

    IF v_limit IS NULL OR v_limit < 1 OR v_usage >= v_limit THEN
        RAISE EXCEPTION
            'Limite de contas de e-mail do plano atingido (% de %).',
            v_usage,
            COALESCE(v_limit, 0)
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_enforce_email_plan_account_limit
ON public.email_settings;

CREATE TRIGGER tr_enforce_email_plan_account_limit
BEFORE INSERT OR UPDATE OF company_id
ON public.email_settings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_email_plan_account_limit();


-- As funções são internas e só devem ser executadas pelos triggers.
REVOKE ALL
ON FUNCTION public.enforce_profile_plan_user_limit()
FROM PUBLIC, anon, authenticated;

REVOKE ALL
ON FUNCTION public.enforce_whatsapp_plan_channel_limit()
FROM PUBLIC, anon, authenticated;

REVOKE ALL
ON FUNCTION public.enforce_email_plan_account_limit()
FROM PUBLIC, anon, authenticated;


-- O frontend já possui assinaturas postgres_changes.
-- As tabelas comerciais precisam fazer parte da publicação correspondente.
DO $block$
DECLARE
    v_table text;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication
        WHERE pubname = 'supabase_realtime'
    ) THEN
        RAISE EXCEPTION
            'Publicação supabase_realtime não encontrada.';
    END IF;

    FOREACH v_table IN ARRAY ARRAY[
        'companies',
        'plans',
        'profiles'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = v_table
        ) THEN
            EXECUTE format(
                'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
                v_table
            );
        END IF;
    END LOOP;
END;
$block$;

COMMENT ON FUNCTION public.enforce_profile_plan_user_limit()
IS 'Etapa 10: enforcement transacional do limite de usuários ativos por plano.';

COMMENT ON FUNCTION public.enforce_whatsapp_plan_channel_limit()
IS 'Etapa 10: enforcement transacional do limite de canais por plano.';

COMMENT ON FUNCTION public.enforce_email_plan_account_limit()
IS 'Etapa 10: enforcement transacional do limite de contas de e-mail por plano.';
