-- FIX RLS RECURSION DEFINITIVELY

-- 1. Create a helper function to get the current user's company_id without triggering RLS on profiles table
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public -- Secure the search path
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

-- 2. RESET PROFILES POLICIES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in same company" ON public.profiles;

-- Allow users to ALWAYS see their own profile (Crucial for initial load)
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (id = auth.uid());

-- Allow users to see other profiles in the same company using the safe function
CREATE POLICY "Users can view profiles in same company"
ON public.profiles FOR SELECT
USING (company_id = public.get_my_company_id());

-- 3. RESET DEPARTMENTS POLICIES
DROP POLICY IF EXISTS "Users can view departments in same company" ON public.departments;

CREATE POLICY "Users can view departments in same company"
ON public.departments FOR SELECT
USING (company_id = public.get_my_company_id());

-- 4. RESET EVENTS POLICIES
DROP POLICY IF EXISTS "Users can view events of their company" ON public.events;
DROP POLICY IF EXISTS "Users can manage events of their company" ON public.events;

CREATE POLICY "Users can view events of their company"
ON public.events FOR SELECT
USING (company_id = public.get_my_company_id());

CREATE POLICY "Users can manage events of their company"
ON public.events FOR ALL
USING (company_id = public.get_my_company_id());

-- 5. Fix update policy just in case
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (id = auth.uid());
