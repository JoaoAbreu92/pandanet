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

  IF p_enabled AND jsonb_typeof(COALESCE(p_permissions, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Formato de permissões inválido';
  END IF;

  IF p_enabled AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(COALESCE(p_permissions->'assigned_queues', '[]'::jsonb)) AS item(queue_id)
    LEFT JOIN public.whatsapp_queues queue
      ON queue.id::text = item.queue_id
     AND queue.company_id = v_company_id
    WHERE queue.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Uma ou mais filas não pertencem à empresa do usuário';
  END IF;

  IF p_enabled AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(COALESCE(p_permissions->'allowed_connections', '[]'::jsonb)) AS item(connection_id)
    LEFT JOIN public.whatsapp_settings connection
      ON connection.id::text = item.connection_id
     AND connection.company_id = v_company_id
    WHERE connection.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Uma ou mais conexões não pertencem à empresa do usuário';
  END IF;

  UPDATE public.profiles
  SET
    whatspanda_permissions = CASE WHEN p_enabled THEN COALESCE(p_permissions, '{}'::jsonb) ELSE NULL END,
    is_whatsapp_agent = p_enabled,
    permissions = COALESCE(permissions, '{}'::jsonb)
      || jsonb_build_object('viewWhatsPanda', p_enabled)
  WHERE id = p_target_user_id
    AND company_id = v_company_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.whatspanda_set_agent_access(uuid, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.whatspanda_set_agent_access(uuid, boolean, jsonb) TO authenticated;

ALTER TABLE public.whatsapp_settings
  ALTER COLUMN close_message
  SET DEFAULT 'Seu atendimento foi concluído. Obrigado pelo contato!';

UPDATE public.whatsapp_settings
SET close_message = 'Seu atendimento foi concluído. Obrigado pelo contato!'
WHERE enable_close_message = true
  AND NULLIF(btrim(close_message), '') IS NULL;

COMMIT;
