BEGIN;

CREATE OR REPLACE FUNCTION public.whatspanda_set_agent_access(
  p_target_user_id uuid,
  p_enabled boolean,
  p_permissions jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_permissions jsonb := COALESCE(p_permissions, '{}'::jsonb);
BEGIN
  SELECT company_id
  INTO v_company_id
  FROM public.profiles
  WHERE id = p_target_user_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  IF NOT (
    public.is_platform_admin()
    OR public.is_company_admin_v2(v_company_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar usuários do WhatsPanda';
  END IF;

  IF p_enabled AND jsonb_typeof(v_permissions) <> 'object' THEN
    RAISE EXCEPTION 'Formato de permissões inválido';
  END IF;

  IF p_enabled THEN
    v_permissions := jsonb_set(
      v_permissions,
      '{assigned_queues}',
      COALESCE((
        SELECT jsonb_agg(queue.id::text ORDER BY queue.name)
        FROM public.whatsapp_queues queue
        WHERE queue.company_id = v_company_id
          AND queue.id::text IN (
            SELECT item.queue_id
            FROM jsonb_array_elements_text(
              CASE
                WHEN jsonb_typeof(v_permissions->'assigned_queues') = 'array'
                THEN v_permissions->'assigned_queues'
                ELSE '[]'::jsonb
              END
            ) AS item(queue_id)
          )
      ), '[]'::jsonb),
      true
    );

    v_permissions := jsonb_set(
      v_permissions,
      '{allowed_connections}',
      COALESCE((
        SELECT jsonb_agg(connection.id::text ORDER BY connection.connection_name)
        FROM public.whatsapp_settings connection
        WHERE connection.company_id = v_company_id
          AND connection.id::text IN (
            SELECT item.connection_id
            FROM jsonb_array_elements_text(
              CASE
                WHEN jsonb_typeof(v_permissions->'allowed_connections') = 'array'
                THEN v_permissions->'allowed_connections'
                ELSE '[]'::jsonb
              END
            ) AS item(connection_id)
          )
      ), '[]'::jsonb),
      true
    );
  END IF;

  UPDATE public.profiles
  SET
    whatspanda_permissions = CASE WHEN p_enabled THEN v_permissions ELSE NULL END,
    is_whatsapp_agent = p_enabled,
    permissions = COALESCE(permissions, '{}'::jsonb)
      || jsonb_build_object('viewWhatsPanda', p_enabled)
  WHERE id = p_target_user_id
    AND company_id = v_company_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.whatspanda_cleanup_deleted_queue_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles profile
  SET whatspanda_permissions = jsonb_set(
    profile.whatspanda_permissions,
    '{assigned_queues}',
    COALESCE((
      SELECT jsonb_agg(item.queue_id)
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(profile.whatspanda_permissions->'assigned_queues') = 'array'
          THEN profile.whatspanda_permissions->'assigned_queues'
          ELSE '[]'::jsonb
        END
      ) AS item(queue_id)
      WHERE item.queue_id <> OLD.id::text
    ), '[]'::jsonb),
    true
  )
  WHERE profile.company_id = OLD.company_id
    AND profile.whatspanda_permissions IS NOT NULL
    AND COALESCE(profile.whatspanda_permissions->'assigned_queues', '[]'::jsonb) ? OLD.id::text;

  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS whatspanda_cleanup_deleted_queue_permissions_trigger
ON public.whatsapp_queues;

CREATE TRIGGER whatspanda_cleanup_deleted_queue_permissions_trigger
AFTER DELETE ON public.whatsapp_queues
FOR EACH ROW
EXECUTE FUNCTION public.whatspanda_cleanup_deleted_queue_permissions();

UPDATE public.profiles profile
SET whatspanda_permissions = jsonb_set(
  profile.whatspanda_permissions,
  '{assigned_queues}',
  COALESCE((
    SELECT jsonb_agg(queue.id::text ORDER BY queue.name)
    FROM public.whatsapp_queues queue
    WHERE queue.company_id = profile.company_id
      AND queue.id::text IN (
        SELECT item.queue_id
        FROM jsonb_array_elements_text(
          CASE
            WHEN jsonb_typeof(profile.whatspanda_permissions->'assigned_queues') = 'array'
            THEN profile.whatspanda_permissions->'assigned_queues'
            ELSE '[]'::jsonb
          END
        ) AS item(queue_id)
      )
  ), '[]'::jsonb),
  true
)
WHERE profile.whatspanda_permissions IS NOT NULL;

REVOKE ALL ON FUNCTION public.whatspanda_set_agent_access(uuid, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.whatspanda_set_agent_access(uuid, boolean, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.whatspanda_cleanup_deleted_queue_permissions() FROM PUBLIC;

COMMIT;
