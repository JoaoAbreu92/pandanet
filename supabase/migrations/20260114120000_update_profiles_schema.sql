-- Add columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS office_location text;

-- Storage Policies for Avatars
CREATE POLICY "Public Access Avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Authenticated Insert Avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Authenticated Update Avatars" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');

-- Storage Policies for Covers
CREATE POLICY "Public Access Covers" ON storage.objects FOR SELECT USING (bucket_id = 'covers');
CREATE POLICY "Authenticated Insert Covers" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'covers');
CREATE POLICY "Authenticated Update Covers" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'covers');
