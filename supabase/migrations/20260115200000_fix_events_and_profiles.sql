-- Fix Events Table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS attendees UUID[] DEFAULT '{}';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES auth.users(id);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS start_time TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_time TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS category TEXT;

-- Enable RLS on events if not enabled
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Ensure profiles has department_id
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- Policies for Events (Idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'Users can view events of their company') THEN
        CREATE POLICY "Users can view events of their company" ON public.events FOR SELECT USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'Users can manage events of their company') THEN
        CREATE POLICY "Users can manage events of their company" ON public.events FOR ALL USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
    END IF;
END $$;
