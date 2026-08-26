REVOKE ALL ON FUNCTION public.create_user_admin(
TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT,
UUID, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN, JSONB, JSONB, DATE,
UUID, UUID, BOOLEAN
) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.update_user_profile(
UUID, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, TEXT,
TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN,
JSONB, JSONB, UUID, UUID, BOOLEAN, BOOLEAN, BOOLEAN
) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.update_user_hierarchy(
UUID, UUID, UUID, BOOLEAN
) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.admin_reset_user_password(
UUID, TEXT
) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.create_admin_user_for_company_safe(
UUID, TEXT, TEXT, TEXT
) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.create_company_with_admin_safe(
TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT
) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.approve_user_and_create_company(
UUID, UUID
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_user_admin(
TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT,
UUID, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN, JSONB, JSONB, DATE,
UUID, UUID, BOOLEAN
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.update_user_profile(
UUID, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, TEXT,
TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN,
JSONB, JSONB, UUID, UUID, BOOLEAN, BOOLEAN, BOOLEAN
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.update_user_hierarchy(
UUID, UUID, UUID, BOOLEAN
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(
UUID, TEXT
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.create_admin_user_for_company_safe(
UUID, TEXT, TEXT, TEXT
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.create_company_with_admin_safe(
TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.approve_user_and_create_company(
UUID, UUID
) TO authenticated, service_role;
