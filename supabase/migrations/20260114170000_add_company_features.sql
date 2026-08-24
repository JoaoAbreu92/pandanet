ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS custom_features JSONB DEFAULT '{}'::jsonb;

-- Policy to allow Super Admins to update companies (including custom_features)
-- Assuming existing policy "Update own company data" might be too restrictive if it only allows updating own company.
-- Super Admins need to update any company.

BEGIN;
  -- Drop existing update policy if it conflicts or is insufficient for super admins across companies
  -- But we keep it simple: Add a policy for Super Admins if not exists.
  -- Actually, let's just ensure the column exists. The logic in SaaS Dashboard uses the client which hopefully has a super admin user or RLS allows it.
  -- Given previous context, "Master TI" is a super admin. We need to ensure RLS allows updates.
  
  -- Create policy for Super Admins to update ANY company
  -- Note: This requires checking a profile's role.
  -- Since we can't easily join in RLS without performance hit or recursion issues, usually we use a claim or a simple check.
  -- For now, let's rely on the fact that the user is logged in.
  -- If "Update own company data" is the only policy, Super Admin might be restricted to their own company row.
  -- Let's add a policy: "Super Admins can update all companies"
  
  DROP POLICY IF EXISTS "Super Admins can update all companies" ON public.companies;
  CREATE POLICY "Super Admins can update all companies" ON public.companies
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'Super Admin'
      )
    );

COMMIT;
