-- Upgrade POSTS table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS media_url TEXT; -- New standardized column
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS mentions UUID[] DEFAULT '{}';

-- Upgrade COMMENTS table
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Create POST_REACTIONS table (replacing simple array)
CREATE TABLE IF NOT EXISTS public.post_reactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    emoji TEXT NOT NULL,
    UNIQUE(post_id, user_id) -- One reaction per user per post (or allow multiple? Logic usually implies toggle)
);

-- RLS for POSTS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View own company posts" ON public.posts;
CREATE POLICY "View own company posts" ON public.posts FOR SELECT USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Insert own company posts" ON public.posts FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Delete own company posts" ON public.posts FOR DELETE USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- RLS for COMMENTS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View own company comments" ON public.comments;
CREATE POLICY "View own company comments" ON public.comments FOR SELECT USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Insert own company comments" ON public.comments FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- RLS for POST_REACTIONS
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own company reactions" ON public.post_reactions FOR SELECT USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Insert own company reactions" ON public.post_reactions FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Delete own company reactions" ON public.post_reactions FOR DELETE USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Backfill company_id for existing rows? 
-- If there are existing rows without company_id, they will be hidden. Better to delete them or assign one.
-- For now, we assume clean slate or we clear bad data.
DELETE FROM public.posts WHERE company_id IS NULL;
DELETE FROM public.comments WHERE company_id IS NULL;
