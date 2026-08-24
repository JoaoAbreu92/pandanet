-- 1. Add email column to profiles (useful for lookups)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email text;

-- 2. Backfill existing emails (Run with elevated privileges)
DO $$
BEGIN
  UPDATE public.profiles p
  SET email = u.email
  FROM auth.users u
  WHERE p.id = u.id
  AND p.email IS NULL;
END $$;

-- 3. Update handle_new_user to:
--    a) specificy email in insert
--    b) Check responsible_email for admin assignment
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_company_id uuid;
  v_resp_email text;
  v_domain text;
  v_role text := 'employee'; -- Default role
BEGIN
  -- Extract domain
  v_domain := lower(substring(new.email from '@(.*)$'));

  -- Find company by domain
  SELECT id, responsible_email INTO v_company_id, v_resp_email 
  FROM public.companies 
  WHERE lower(domain) = v_domain 
  LIMIT 1;

  -- Check if this user is the responsible one
  IF v_resp_email IS NOT NULL AND lower(new.email) = lower(v_resp_email) THEN
    v_role := 'admin';
  END IF;

  -- Insert profile
  INSERT INTO public.profiles (id, full_name, company_id, role, email)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    v_company_id,
    v_role,
    new.email
  );

  RETURN new;
END;
$function$;

-- 4. Audit RLS for Profiles to allow finding by email (if needed for the dashboard "Make Admin" feature)
-- We already allowed "Authenticated users can view profiles" in previous step, so 'select' should work.
-- We ensured Super Admin can update using 'authenticated' role hack in previous step, so 'update' should work.
