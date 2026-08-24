-- Comprehensive RLS Fix for Profiles, Departments, and Events

-- 1. PROFILES: Allow users to view ALL profiles in their company
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in same company" ON public.profiles;

CREATE POLICY "Users can view profiles in same company" 
ON public.profiles FOR SELECT 
USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Also allow update for own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (id = auth.uid());


-- 2. DEPARTMENTS: Allow view for company members
DROP POLICY IF EXISTS "Users can view departments in same company" ON public.departments;

CREATE POLICY "Users can view departments in same company"
ON public.departments FOR SELECT
USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));


-- 3. EVENTS: Allow view/insert/update/delete for company members
DROP POLICY IF EXISTS "Users can view events of their company" ON public.events;
DROP POLICY IF EXISTS "Users can manage events of their company" ON public.events;

CREATE POLICY "Users can view events of their company"
ON public.events FOR SELECT
USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage events of their company"
ON public.events FOR ALL
USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));


-- 4. FIX AUTH.USERS ACCESS (Optional but helpful for debugging)
-- Some setups might need explicit GRANTs
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
