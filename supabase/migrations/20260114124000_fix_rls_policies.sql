-- Drop existing select policy to replace it with a more permissive one for admins
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

-- Create a new policy that allows:
-- 1. Users to see their own profile (original rule)
-- 2. Users to see other profiles in the SAME company (needed for company admins/colleagues)
-- 3. Super Admins (is_admin = true) to see ALL profiles

CREATE POLICY "View Profiles Policy" ON profiles FOR SELECT
USING (
  auth.uid() = id -- Own profile
  OR 
  company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()) -- Same company
  OR
  (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true -- Super Admin
);
