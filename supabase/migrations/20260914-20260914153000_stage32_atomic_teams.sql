BEGIN;

CREATE OR REPLACE FUNCTION public.stage32_save_team(
  p_company_id uuid,
  p_original_name text,
  p_new_name text,
  p_member_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  normalized_name text := btrim(p_new_name);
  team_conversation_id uuid;
  valid_members integer;
  previous_team_names text[];
BEGIN
  IF NOT stage32_can_manage_company(p_company_id) THEN
    RAISE EXCEPTION 'Sem permissão para administrar equipes desta empresa.';
  END IF;
  IF normalized_name = '' OR char_length(normalized_name) > 80 THEN
    RAISE EXCEPTION 'Informe um nome de equipe válido com até 80 caracteres.';
  END IF;
  IF COALESCE(array_length(p_member_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos um membro.';
  END IF;

  SELECT count(*) INTO valid_members
  FROM profiles
  WHERE company_id = p_company_id AND id = ANY(p_member_ids);
  IF valid_members <> (SELECT count(DISTINCT member_id) FROM unnest(p_member_ids) AS member_id) THEN
    RAISE EXCEPTION 'Um ou mais membros não pertencem à empresa.';
  END IF;

  SELECT array_agg(DISTINCT team) INTO previous_team_names
  FROM profiles
  WHERE company_id = p_company_id
    AND id = ANY(p_member_ids)
    AND team IS NOT NULL
    AND team <> 'Sem Equipe'
    AND team <> COALESCE(p_original_name, '')
    AND team <> normalized_name;

  IF p_original_name IS NULL AND EXISTS (
    SELECT 1 FROM profiles WHERE company_id = p_company_id AND team = normalized_name
  ) THEN
    RAISE EXCEPTION 'Já existe uma equipe com este nome.';
  END IF;

  IF p_original_name IS NOT NULL
     AND normalized_name <> p_original_name
     AND EXISTS (
       SELECT 1 FROM profiles
       WHERE company_id = p_company_id AND team = normalized_name
     ) THEN
    RAISE EXCEPTION 'Já existe uma equipe com este nome.';
  END IF;

  IF p_original_name IS NOT NULL THEN
    UPDATE profiles SET team = 'Sem Equipe'
    WHERE company_id = p_company_id
      AND team = p_original_name
      AND NOT (id = ANY(p_member_ids));
  END IF;

  UPDATE profiles SET team = normalized_name
  WHERE company_id = p_company_id AND id = ANY(p_member_ids);

  DELETE FROM conversation_participants cp
  USING conversations c
  WHERE cp.conversation_id = c.id
    AND c.company_id = p_company_id
    AND c.is_group = true
    AND c.group_name = ANY(COALESCE(previous_team_names, ARRAY[]::text[]))
    AND cp.user_id = ANY(p_member_ids);

  DELETE FROM conversations c
  WHERE c.company_id = p_company_id
    AND c.is_group = true
    AND c.group_name = ANY(COALESCE(previous_team_names, ARRAY[]::text[]))
    AND NOT EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.company_id = p_company_id AND p.team = c.group_name
    );

  SELECT id INTO team_conversation_id
  FROM conversations
  WHERE company_id = p_company_id AND is_group = true
    AND group_name = COALESCE(p_original_name, normalized_name)
  ORDER BY created_at LIMIT 1 FOR UPDATE;

  IF team_conversation_id IS NULL THEN
    INSERT INTO conversations(company_id, is_group, group_name, last_message, last_message_at, created_by)
    VALUES (p_company_id, true, normalized_name, 'Grupo da equipe criado', now(), auth.uid())
    RETURNING id INTO team_conversation_id;
  ELSE
    UPDATE conversations SET group_name = normalized_name
    WHERE id = team_conversation_id AND company_id = p_company_id;
    DELETE FROM conversation_participants WHERE conversation_id = team_conversation_id;
  END IF;

  INSERT INTO conversation_participants(conversation_id, user_id, company_id)
  SELECT team_conversation_id, member_id, p_company_id
  FROM unnest(p_member_ids) AS member_id
  ON CONFLICT DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.stage32_delete_team(p_company_id uuid, p_team_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT stage32_can_manage_company(p_company_id) THEN
    RAISE EXCEPTION 'Sem permissão para administrar equipes desta empresa.';
  END IF;
  UPDATE profiles SET team = 'Sem Equipe'
  WHERE company_id = p_company_id AND team = p_team_name;
  DELETE FROM conversations
  WHERE company_id = p_company_id AND is_group = true AND group_name = p_team_name;
END;
$function$;

REVOKE ALL ON FUNCTION public.stage32_save_team(uuid, text, text, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stage32_delete_team(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stage32_save_team(uuid, text, text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stage32_delete_team(uuid, text) TO authenticated;

COMMIT;
