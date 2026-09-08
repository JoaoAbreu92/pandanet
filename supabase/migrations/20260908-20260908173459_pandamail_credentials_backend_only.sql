BEGIN;
REVOKE ALL PRIVILEGES ON TABLE public.email_settings FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.email_settings TO service_role;
DO $$
DECLARE unsafe_count bigint;
BEGIN
  SELECT COUNT(*) INTO unsafe_count
  FROM information_schema.role_table_grants
  WHERE table_schema='public' AND table_name='email_settings'
    AND grantee IN ('anon','authenticated');
  IF unsafe_count <> 0 THEN
    RAISE EXCEPTION 'Persistem % permissões diretas inseguras em email_settings.', unsafe_count;
  END IF;
END $$;
COMMIT;
