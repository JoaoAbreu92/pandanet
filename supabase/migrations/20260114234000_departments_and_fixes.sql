-- 1. Create departments table
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL
);

-- 2. Add department_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- 3. Add department_id and assigned_user_id to tickets
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. Enable RLS on departments
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- 5. Policies for departments
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
        AND (is_admin = true OR is_company_admin = true OR role = 'Super Admin')
    )
);

-- 6. Insert default 'TI' department if not exists (handling this in app logic is safer, but here is a helper)
-- INSERT INTO public.departments (name, company_id) ... 
