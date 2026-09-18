BEGIN;

CREATE OR REPLACE FUNCTION public.stage33_create_project(
  target_name text,
  target_description text DEFAULT NULL,
  target_color text DEFAULT '#10B981',
  target_manager_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  actor_id uuid := auth.uid();
  actor_company_id uuid;
  new_project_id uuid;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Sessão autenticada obrigatória';
  END IF;

  SELECT profile.company_id
  INTO actor_company_id
  FROM public.profiles profile
  WHERE profile.id = actor_id;

  IF actor_company_id IS NULL THEN
    RAISE EXCEPTION 'O usuário autenticado não possui empresa válida';
  END IF;

  IF NULLIF(btrim(target_name), '') IS NULL THEN
    RAISE EXCEPTION 'O nome do projeto é obrigatório';
  END IF;

  IF target_manager_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.profiles manager
    WHERE manager.id = target_manager_id
      AND manager.company_id = actor_company_id
  ) THEN
    RAISE EXCEPTION 'O gerente selecionado não pertence à empresa do projeto';
  END IF;

  INSERT INTO public.projects (
    company_id,
    name,
    description,
    color,
    manager_id,
    status,
    created_by
  )
  VALUES (
    actor_company_id,
    btrim(target_name),
    NULLIF(btrim(COALESCE(target_description, '')), ''),
    COALESCE(NULLIF(btrim(target_color), ''), '#10B981'),
    target_manager_id,
    'active',
    actor_id
  )
  RETURNING id INTO new_project_id;

  RETURN new_project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.stage33_create_project(text, text, text, uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stage33_create_project(text, text, text, uuid)
TO authenticated;

COMMIT;
