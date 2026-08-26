-- ============================================================
-- ETAPA 08
-- PROTECAO DOS CONTROLES COMERCIAIS DO SaaS
-- ============================================================


-- ============================================================
-- 1. GUARD DE CAMPOS COMERCIAIS DA EMPRESA
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_company_commercial_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN

    -- Platform Admin pode administrar todos os campos.
    IF COALESCE(public.is_platform_admin(), false) THEN
        RETURN NEW;
    END IF;


    -- --------------------------------------------------------
    -- CAMPOS EXCLUSIVOS DO SUPER ADMIN
    -- --------------------------------------------------------

    IF NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN
        RAISE EXCEPTION 'Alteracao de plano permitida somente ao Platform Admin';
    END IF;

    IF NEW.subscription_end_date IS DISTINCT FROM OLD.subscription_end_date THEN
        RAISE EXCEPTION 'Alteracao de assinatura permitida somente ao Platform Admin';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'Alteracao de status permitida somente ao Platform Admin';
    END IF;

    IF NEW.name IS DISTINCT FROM OLD.name THEN
        RAISE EXCEPTION 'Alteracao do nome cadastral permitida somente ao Platform Admin';
    END IF;

    IF NEW.domain IS DISTINCT FROM OLD.domain THEN
        RAISE EXCEPTION 'Alteracao de dominio permitida somente ao Platform Admin';
    END IF;

    IF NEW.cnpj IS DISTINCT FROM OLD.cnpj THEN
        RAISE EXCEPTION 'Alteracao de CNPJ permitida somente ao Platform Admin';
    END IF;

    IF NEW.responsible_name IS DISTINCT FROM OLD.responsible_name THEN
        RAISE EXCEPTION 'Alteracao do responsavel permitida somente ao Platform Admin';
    END IF;

    IF NEW.responsible_email IS DISTINCT FROM OLD.responsible_email THEN
        RAISE EXCEPTION 'Alteracao do responsavel permitida somente ao Platform Admin';
    END IF;


    -- --------------------------------------------------------
    -- CUSTOM FEATURES
    --
    -- Company Admin pode alterar SOMENTE a opcao operacional
    -- allow_users_multiple_emails.
    --
    -- Todo o restante representa recursos/modulos controlados
    -- comercialmente pelo Painel SaaS.
    -- --------------------------------------------------------

    IF
        COALESCE(NEW.custom_features, '{}'::jsonb)
            - 'allow_users_multiple_emails'
        IS DISTINCT FROM
        COALESCE(OLD.custom_features, '{}'::jsonb)
            - 'allow_users_multiple_emails'
    THEN
        RAISE EXCEPTION 'Alteracao de modulos permitida somente ao Platform Admin';
    END IF;


    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS tr_guard_company_commercial_fields
ON public.companies;

CREATE TRIGGER tr_guard_company_commercial_fields
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.guard_company_commercial_fields();


REVOKE ALL ON FUNCTION public.guard_company_commercial_fields()
FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 2. PLANOS
-- CRIAR / ALTERAR / EXCLUIR SOMENTE PLATFORM ADMIN
-- ============================================================

DROP POLICY IF EXISTS
"Enable insert for authenticated users only"
ON public.plans;

DROP POLICY IF EXISTS
"Enable update for authenticated users only"
ON public.plans;

DROP POLICY IF EXISTS
"Enable delete for authenticated users only"
ON public.plans;


DROP POLICY IF EXISTS plans_insert_platform_admin
ON public.plans;

DROP POLICY IF EXISTS plans_update_platform_admin
ON public.plans;

DROP POLICY IF EXISTS plans_delete_platform_admin
ON public.plans;


CREATE POLICY plans_insert_platform_admin
ON public.plans
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_platform_admin()
);


CREATE POLICY plans_update_platform_admin
ON public.plans
FOR UPDATE
TO authenticated
USING (
    public.is_platform_admin()
)
WITH CHECK (
    public.is_platform_admin()
);


CREATE POLICY plans_delete_platform_admin
ON public.plans
FOR DELETE
TO authenticated
USING (
    public.is_platform_admin()
);
