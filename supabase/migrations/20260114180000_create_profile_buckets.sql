-- Create storage buckets for user profiles
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

-- Policy: Anyone can view avatars
drop policy if exists "Public Access Avatars" on storage.objects;
create policy "Public Access Avatars"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

-- Policy: Users can upload their own avatar
drop policy if exists "User Upload Avatar" on storage.objects;
create policy "User Upload Avatar"
  on storage.objects for insert
  with check ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- Policy: Users can update their own avatar
drop policy if exists "User Update Avatar" on storage.objects;
create policy "User Update Avatar"
  on storage.objects for update
  using ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- Policy: Anyone can view covers
drop policy if exists "Public Access Covers" on storage.objects;
create policy "Public Access Covers"
  on storage.objects for select
  using ( bucket_id = 'covers' );

-- Policy: Users can upload their own cover
drop policy if exists "User Upload Cover" on storage.objects;
create policy "User Upload Cover"
  on storage.objects for insert
  with check ( bucket_id = 'covers' AND auth.role() = 'authenticated' );

-- Policy: Users can update their own cover
drop policy if exists "User Update Cover" on storage.objects;
create policy "User Update Cover"
  on storage.objects for update
  using ( bucket_id = 'covers' AND auth.role() = 'authenticated' );
