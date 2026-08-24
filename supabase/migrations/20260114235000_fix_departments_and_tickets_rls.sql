
-- 1. Departments RLS Fix
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view departments of their company" ON public.departments;
CREATE POLICY "Users can view departments of their company" 
ON public.departments FOR SELECT 
TO authenticated 
USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;
CREATE POLICY "Admins can manage departments" 
ON public.departments FOR ALL
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (is_admin = true OR is_company_admin = true OR role = 'admin' OR role = 'Super Admin')
    )
);

-- 2. Tickets Table (Ensure it exists and has correct RLS)
CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    requester_id UUID REFERENCES public.profiles(id) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Pendente',
    priority TEXT DEFAULT 'Média',
    department_id UUID REFERENCES public.departments(id),
    assigned_to_id UUID REFERENCES public.profiles(id)
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own company tickets" ON public.tickets;
CREATE POLICY "Users can view own company tickets" 
ON public.tickets FOR SELECT 
TO authenticated 
USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own company tickets" ON public.tickets;
CREATE POLICY "Users can insert own company tickets" 
ON public.tickets FOR INSERT 
TO authenticated 
WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage tickets" ON public.tickets;
CREATE POLICY "Admins can manage tickets" 
ON public.tickets FOR ALL
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (is_admin = true OR is_company_admin = true OR role = 'admin' OR role = 'Super Admin')
    )
);

-- 3. Additional fix for Profile counting in SaaS Dashboard (if needed)
-- Ensure 'profiles' are visible to Super Admin for counting
DROP POLICY IF EXISTS "Super Admin can view all profiles" ON public.profiles;
CREATE POLICY "Super Admin can view all profiles" ON public.profiles FOR SELECT USING (true);
