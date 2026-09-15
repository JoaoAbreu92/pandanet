BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'jobs-media',
  'jobs-media',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS jobs_media_public_read ON storage.objects;
DROP POLICY IF EXISTS jobs_media_insert_manager ON storage.objects;
DROP POLICY IF EXISTS jobs_media_update_manager ON storage.objects;
DROP POLICY IF EXISTS jobs_media_delete_manager ON storage.objects;

CREATE POLICY jobs_media_public_read ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'jobs-media');

CREATE POLICY jobs_media_insert_manager ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'jobs-media'
  AND split_part(name, '/', 1) = public.get_user_company_id()::text
  AND split_part(name, '/', 2) = auth.uid()::text
  AND public.stage32_can_manage_company(public.get_user_company_id())
);

CREATE POLICY jobs_media_update_manager ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'jobs-media'
  AND split_part(name, '/', 1) = public.get_user_company_id()::text
  AND public.stage32_can_manage_company(public.get_user_company_id())
)
WITH CHECK (
  bucket_id = 'jobs-media'
  AND split_part(name, '/', 1) = public.get_user_company_id()::text
  AND public.stage32_can_manage_company(public.get_user_company_id())
);

CREATE POLICY jobs_media_delete_manager ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'jobs-media'
  AND split_part(name, '/', 1) = public.get_user_company_id()::text
  AND public.stage32_can_manage_company(public.get_user_company_id())
);

COMMIT;
