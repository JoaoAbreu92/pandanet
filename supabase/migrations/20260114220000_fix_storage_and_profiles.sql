-- Fix Storage and Profile Persistence

-- 1. Ensure Buckets Exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('feed-media', 'feed-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Storage Policies (Simplified for Reliability)
-- Allow Authenticated upload to avatars
DROP POLICY IF EXISTS "Avatar Upload" ON storage.objects;
CREATE POLICY "Avatar Upload" ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatar Update" ON storage.objects;
CREATE POLICY "Avatar Update" ON storage.objects FOR UPDATE TO authenticated 
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatar Select" ON storage.objects;
CREATE POLICY "Avatar Select" ON storage.objects FOR SELECT TO public 
USING (bucket_id = 'avatars');

-- Allow Authenticated upload to covers
DROP POLICY IF EXISTS "Cover Upload" ON storage.objects;
CREATE POLICY "Cover Upload" ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'covers');

DROP POLICY IF EXISTS "Cover Update" ON storage.objects;
CREATE POLICY "Cover Update" ON storage.objects FOR UPDATE TO authenticated 
USING (bucket_id = 'covers');

DROP POLICY IF EXISTS "Cover Select" ON storage.objects;
CREATE POLICY "Cover Select" ON storage.objects FOR SELECT TO public 
USING (bucket_id = 'covers');


-- 3. Profile Updates
-- Ensure users can update their own profile columns
-- Drop restrictive policies and add a clean one
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- Ensure Insert is allowed (triggered by App.tsx upsert)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);

-- 4. Grant usage on sequences if any (usually UUIDs don't need this, but good practice)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
