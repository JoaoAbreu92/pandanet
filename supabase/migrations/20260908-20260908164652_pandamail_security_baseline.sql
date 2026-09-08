BEGIN;

UPDATE public.email_settings AS settings
SET company_id = profiles.company_id
FROM public.profiles AS profiles
WHERE settings.company_id IS NULL
  AND settings.user_id = profiles.id
  AND profiles.company_id IS NOT NULL;

DO $$
DECLARE
    missing_company_count bigint;
BEGIN
    SELECT COUNT(*)
    INTO missing_company_count
    FROM public.email_settings
    WHERE company_id IS NULL;

    IF missing_company_count <> 0 THEN
        RAISE EXCEPTION
            'Ainda existem % conta(s) de e-mail sem empresa.',
            missing_company_count;
    END IF;
END
$$;

REVOKE ALL PRIVILEGES
ON TABLE
    public.email_settings,
    public.email_contacts,
    public.email_contact_groups,
    public.email_contact_group_members,
    public.email_metadata,
    public.email_tags,
    public.emails
FROM anon;

REVOKE TRUNCATE, REFERENCES, TRIGGER
ON TABLE
    public.email_settings,
    public.email_contacts,
    public.email_contact_groups,
    public.email_contact_group_members,
    public.email_metadata,
    public.email_tags,
    public.emails
FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE
    public.email_settings,
    public.email_contacts,
    public.email_contact_groups,
    public.email_contact_group_members,
    public.email_metadata,
    public.email_tags,
    public.emails
TO authenticated;

GRANT ALL PRIVILEGES
ON TABLE
    public.email_settings,
    public.email_contacts,
    public.email_contact_groups,
    public.email_contact_group_members,
    public.email_metadata,
    public.email_tags,
    public.emails
TO service_role;

DO $$
DECLARE
    missing_company_count bigint;
    anonymous_grant_count bigint;
    dangerous_grant_count bigint;
BEGIN
    SELECT COUNT(*)
    INTO missing_company_count
    FROM public.email_settings
    WHERE company_id IS NULL;

    SELECT COUNT(*)
    INTO anonymous_grant_count
    FROM information_schema.role_table_grants
    WHERE grantee = 'anon'
      AND table_schema = 'public'
      AND table_name IN (
          'email_settings',
          'email_contacts',
          'email_contact_groups',
          'email_contact_group_members',
          'email_metadata',
          'email_tags',
          'emails'
      );

    SELECT COUNT(*)
    INTO dangerous_grant_count
    FROM information_schema.role_table_grants
    WHERE grantee = 'authenticated'
      AND table_schema = 'public'
      AND table_name IN (
          'email_settings',
          'email_contacts',
          'email_contact_groups',
          'email_contact_group_members',
          'email_metadata',
          'email_tags',
          'emails'
      )
      AND privilege_type IN (
          'TRUNCATE',
          'REFERENCES',
          'TRIGGER'
      );

    IF missing_company_count <> 0 THEN
        RAISE EXCEPTION
            'Validação falhou: % conta(s) sem empresa.',
            missing_company_count;
    END IF;

    IF anonymous_grant_count <> 0 THEN
        RAISE EXCEPTION
            'Validação falhou: % permissão(ões) anônima(s).',
            anonymous_grant_count;
    END IF;

    IF dangerous_grant_count <> 0 THEN
        RAISE EXCEPTION
            'Validação falhou: % permissão(ões) perigosa(s).',
            dangerous_grant_count;
    END IF;
END
$$;

COMMIT;
