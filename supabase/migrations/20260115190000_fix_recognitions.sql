-- Drop table to ensure new schema (removing legacy version)
DROP TABLE IF EXISTS public.recognitions CASCADE;

-- Ensure recognitions table exists
CREATE TABLE public.recognitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    from_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    to_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recognitions ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
    -- View Policy: Allow all users in the same company to see recognitions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recognitions' AND policyname = 'Users can view company recognitions') THEN
        CREATE POLICY "Users can view company recognitions" ON public.recognitions
        FOR SELECT USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
    END IF;

    -- Insert Policy: Allow authenticated users to create recognitions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recognitions' AND policyname = 'Users can create recognitions') THEN
        CREATE POLICY "Users can create recognitions" ON public.recognitions
        FOR INSERT WITH CHECK (auth.uid() = from_id);
    END IF;
    
    -- Drop restrictive policies if any (optional cleanup)
END $$;
