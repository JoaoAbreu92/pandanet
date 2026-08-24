
-- SCHEMA REPAIR MIGRATION
-- This migration ensures all features have dedicated tables and proper RLS.

-- 1. BANNERS TABLE
CREATE TABLE IF NOT EXISTS public.banners (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    image_url TEXT NOT NULL,
    title TEXT,
    subtitle TEXT,
    link TEXT
);

-- 2. MARKETPLACE ITEMS (Ensure it exists and has correct columns)
CREATE TABLE IF NOT EXISTS public.marketplace_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    listed_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL DEFAULT 0,
    category TEXT,
    condition TEXT CHECK (condition IN ('Novo', 'Quase Novo', 'Bom', 'Usado')),
    status TEXT CHECK (status IN ('Disponível', 'Reservado', 'Vendido')) DEFAULT 'Disponível',
    image_urls JSONB DEFAULT '[]'::jsonb,
    reserved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 3. TI REQUESTS (Ensure it exists)
CREATE TABLE IF NOT EXISTS public.ti_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    requester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    request_type TEXT CHECK (request_type IN ('Hardware', 'Software')),
    item_name TEXT NOT NULL,
    justification TEXT,
    status TEXT CHECK (status IN ('Pendente', 'Em Análise', 'Aprovado', 'Pedido Realizado', 'Entregue', 'Rejeitado')) DEFAULT 'Pendente'
);

-- 4. RECOGNITIONS (Ensure it exists)
CREATE TABLE IF NOT EXISTS public.recognitions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    from_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    to_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    message TEXT NOT NULL,
    value_tag TEXT CHECK (value_tag IN ('Trabalho em Equipe', 'Inovação', 'Foco no Cliente', 'Qualidade'))
);

-- 5. WELLNESS ITEMS (Ensure it exists)
CREATE TABLE IF NOT EXISTS public.wellness_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK (category IN ('Saúde Mental', 'Atividade Física', 'Nutrição', 'Outro')),
    video_url TEXT,
    link_url TEXT,
    link_text TEXT DEFAULT 'Saiba mais'
);

-- 6. KB ARTICLES (Ensure it exists)
CREATE TABLE IF NOT EXISTS public.kb_articles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    category TEXT,
    views INTEGER DEFAULT 0,
    media_url TEXT,
    media_type TEXT CHECK (media_type IN ('image', 'video'))
);

-- 7. ENABLE RLS ON ALL RELEVANT TABLES
DO $$ 
DECLARE 
    tbl text;
BEGIN 
    FOR tbl IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN (
            'announcements', 'banners', 'events', 'tickets', 'marketplace_items', 
            'ti_requests', 'recognitions', 'benefits', 'wellness_items', 
            'kb_articles', 'policies', 'form_submissions', 'trainings'
        ) 
    LOOP 
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
        
        -- Drop existing to avoid conflicts
        EXECUTE format('DROP POLICY IF EXISTS "View company %I" ON public.%I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Insert company %I" ON public.%I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Update company %I" ON public.%I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Delete company %I" ON public.%I', tbl, tbl);

        -- New Standardized Policies
        EXECUTE format('CREATE POLICY "View company %I" ON public.%I FOR SELECT USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()))', tbl, tbl);
        EXECUTE format('CREATE POLICY "Insert company %I" ON public.%I FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()))', tbl, tbl);
        EXECUTE format('CREATE POLICY "Update company %I" ON public.%I FOR UPDATE USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()))', tbl, tbl);
        EXECUTE format('CREATE POLICY "Delete company %I" ON public.%I FOR DELETE USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()))', tbl, tbl);
    END LOOP; 
END $$;

-- 8. STORAGE BUCKET FOR MARKETPLACE
INSERT INTO storage.buckets (id, name, public) VALUES ('marketplace-media', 'marketplace-media', true) ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policy for marketplace
DROP POLICY IF EXISTS "Public Read Marketplace" ON storage.objects;
CREATE POLICY "Public Read Marketplace" ON storage.objects FOR SELECT TO public USING (bucket_id = 'marketplace-media');

DROP POLICY IF EXISTS "Auth Upload Marketplace" ON storage.objects;
CREATE POLICY "Auth Upload Marketplace" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'marketplace-media');
