-- FIX SAAS DASHBOARD MIGRATION
-- Adds missing cnpj column and fixes plan creation permissions.

-- 1. Add cnpj column to companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS cnpj TEXT;

-- 2. Handle plans table defaults
ALTER TABLE public.plans ALTER COLUMN type SET DEFAULT 'monthly';

-- 3. Grant Permissions to Authenticated Users
-- Since the dashboard is used by Super Admins (who are authenticated users),
-- they need permissions to manage plans and companies.
GRANT ALL ON public.plans TO authenticated;
GRANT ALL ON public.companies TO authenticated;
GRANT ALL ON public.profiles TO authenticated;

-- 4. Enable RLS and Policies for Plans
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view plans" ON public.plans;
CREATE POLICY "Authenticated can view plans" ON public.plans
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Super Admins can manage plans" ON public.plans;
CREATE POLICY "Super Admins can manage plans" ON public.plans
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'Super Admin'
    )
);

-- 5. Refine Policies for Companies
-- Ensure Super Admins can manage all companies
DROP POLICY IF EXISTS "Super Admins can insert companies" ON public.companies;
CREATE POLICY "Super Admins can insert companies" ON public.companies
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'Super Admin'
    )
);

DROP POLICY IF EXISTS "Super Admins can update companies" ON public.companies;
CREATE POLICY "Super Admins can update companies" ON public.companies
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'Super Admin'
    )
);

DROP POLICY IF EXISTS "Super Admins can delete companies" ON public.companies;
CREATE POLICY "Super Admins can delete companies" ON public.companies
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'Super Admin'
    )
);

-- Profiles: Ensure Super Admin can update roles
DROP POLICY IF EXISTS "Super Admins can update any profile" ON public.profiles;
CREATE POLICY "Super Admins can update any profile" ON public.profiles
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'Super Admin'
    )
);

-- Sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
