BEGIN;

CREATE OR REPLACE FUNCTION public.replace_whatsapp_chatbot_nodes(
  p_flow_id uuid,
  p_nodes jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_count integer;
BEGIN
  SELECT company_id INTO v_company_id
  FROM public.whatsapp_chatbot_flows
  WHERE id = p_flow_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Fluxo não encontrado.';
  END IF;

  IF NOT (public.is_platform_admin() OR public.is_company_admin_v2(v_company_id)) THEN
    RAISE EXCEPTION 'Sem permissão para alterar este fluxo.';
  END IF;

  IF jsonb_typeof(p_nodes) <> 'array' OR jsonb_array_length(p_nodes) = 0 THEN
    RAISE EXCEPTION 'O fluxo deve possuir ao menos uma etapa.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_nodes) item
    WHERE coalesce(item->>'type', '') = '' OR jsonb_typeof(item->'content') <> 'object'
  ) THEN
    RAISE EXCEPTION 'Uma ou mais etapas são inválidas.';
  END IF;

  DELETE FROM public.whatsapp_chatbot_nodes WHERE flow_id = p_flow_id;

  INSERT INTO public.whatsapp_chatbot_nodes(id, flow_id, type, content, position_x, position_y, sort_order)
  SELECT
    coalesce(nullif(item->>'id','')::uuid, gen_random_uuid()),
    p_flow_id,
    item->>'type',
    item->'content',
    coalesce((item->>'position_x')::integer, 0),
    coalesce((item->>'position_y')::integer, 0),
    coalesce((item->>'sort_order')::integer, ordinality::integer - 1)
  FROM jsonb_array_elements(p_nodes) WITH ORDINALITY AS source(item, ordinality);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_whatsapp_chatbot_nodes(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_whatsapp_chatbot_nodes(uuid, jsonb) TO authenticated;

COMMIT;
