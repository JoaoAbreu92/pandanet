BEGIN;

UPDATE public.profiles
SET permissions =
    jsonb_set(
        jsonb_set(
            COALESCE(permissions, '{}'::jsonb),
            '{canSendChatAttachments}',
            COALESCE(permissions -> 'canSendChatAttachments', 'true'::jsonb),
            true
        ),
        '{chatAttachmentMaxMb}',
        COALESCE(permissions -> 'chatAttachmentMaxMb', '10'::jsonb),
        true
    )
WHERE
    NOT COALESCE(permissions, '{}'::jsonb) ? 'canSendChatAttachments'
    OR NOT COALESCE(permissions, '{}'::jsonb) ? 'chatAttachmentMaxMb';

CREATE OR REPLACE FUNCTION public.set_internal_chat_attachment_policy(
    p_company_id uuid,
    p_scope text,
    p_department_id uuid DEFAULT NULL,
    p_enabled boolean DEFAULT true,
    p_max_mb integer DEFAULT 10
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    caller_profile public.profiles%ROWTYPE;
    affected_rows integer := 0;
BEGIN
    SELECT *
    INTO caller_profile
    FROM public.profiles
    WHERE id = auth.uid();

    IF caller_profile.id IS NULL THEN
        RAISE EXCEPTION 'Perfil administrativo não localizado.';
    END IF;

    IF NOT (
        caller_profile.role = 'Super Admin'
        OR (
            COALESCE(caller_profile.is_admin, false)
            AND caller_profile.company_id = p_company_id
        )
        OR (
            COALESCE(caller_profile.is_company_admin, false)
            AND caller_profile.company_id = p_company_id
        )
    ) THEN
        RAISE EXCEPTION 'Você não possui permissão para alterar políticas de anexos.';
    END IF;

    IF p_scope NOT IN ('all', 'department') THEN
        RAISE EXCEPTION 'Escopo inválido. Use all ou department.';
    END IF;

    IF p_max_mb IS NULL OR p_max_mb < 1 OR p_max_mb > 200 THEN
        RAISE EXCEPTION 'O limite precisa estar entre 1 e 200 MB.';
    END IF;

    IF p_scope = 'department' THEN
        IF p_department_id IS NULL THEN
            RAISE EXCEPTION 'Selecione um departamento.';
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM public.departments d
            WHERE d.id = p_department_id
              AND d.company_id = p_company_id
        ) THEN
            RAISE EXCEPTION 'Departamento inválido para esta empresa.';
        END IF;
    END IF;

    UPDATE public.profiles p
    SET permissions =
        jsonb_set(
            jsonb_set(
                COALESCE(p.permissions, '{}'::jsonb),
                '{canSendChatAttachments}',
                to_jsonb(p_enabled),
                true
            ),
            '{chatAttachmentMaxMb}',
            to_jsonb(p_max_mb),
            true
        )
    WHERE p.company_id = p_company_id
      AND (
          p_scope = 'all'
          OR (
              p_scope = 'department'
              AND (
                  p.department_id = p_department_id
                  OR EXISTS (
                      SELECT 1
                      FROM public.department_users du
                      WHERE du.company_id = p_company_id
                        AND du.department_id = p_department_id
                        AND du.user_id = p.id
                  )
              )
          )
      );

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN affected_rows;
END;
$function$;

REVOKE ALL
ON FUNCTION public.set_internal_chat_attachment_policy(
    uuid,
    text,
    uuid,
    boolean,
    integer
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.set_internal_chat_attachment_policy(
    uuid,
    text,
    uuid,
    boolean,
    integer
)
TO authenticated;

COMMIT;
