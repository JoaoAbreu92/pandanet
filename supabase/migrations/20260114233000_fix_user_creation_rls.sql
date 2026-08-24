-- FIX USER CREATION RLS
-- Allows admins to create and manage profiles.

-- 1. Ensure the id column has a default for records created via Dashboard (MVP logic)
-- Note: It still references auth.users(id), but this allows inserting the record 
-- and later linking it when the user signs up if needed.
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- 2. Drop existing restrictive policies to avoid conflicts
DROP POLICY IF EXISTS "Insert Own Profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Update Own Profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super Admins can update any profile" ON public.profiles;

-- 3. Comprehensive Policies for Profiles

-- SELECT: Already open for authenticated users in most setups, ensuring it here.
DROP POLICY IF EXISTS "View Profiles" ON public.profiles;
CREATE POLICY "View Profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

-- INSERT: Super Admin, Company Admin, or the User themselves
CREATE POLICY "Manage Profile Insertion" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
    -- Super Admin can insert anything
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Super Admin'))
    OR
    -- Company Admin can insert for their own company
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_company_admin = true OR role = 'admin') AND company_id = profiles.company_id))
    OR
    -- User can insert their own profile
    (auth.uid() = id)
);

-- UPDATE: Super Admin, Company Admin, or the User themselves
CREATE POLICY "Manage Profile Updates" ON public.profiles
FOR UPDATE TO authenticated
USING (
    -- Super Admin bypass
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Super Admin'))
    OR
    -- Company Admin scope
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_company_admin = true OR role = 'admin') AND company_id = profiles.company_id))
    OR
    -- Self update
    (auth.uid() = id)
);

-- DELETE: Admins only
DROP POLICY IF EXISTS "Manage Profile Deletion" ON public.profiles;
CREATE POLICY "Manage Profile Deletion" ON public.profiles
FOR DELETE TO authenticated
USING (
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Super Admin'))
    OR
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_company_admin = true OR role = 'admin') AND company_id = profiles.company_id))
);

-- 4. Ensure permissions are granted
GRANT ALL ON public.profiles TO authenticated;
