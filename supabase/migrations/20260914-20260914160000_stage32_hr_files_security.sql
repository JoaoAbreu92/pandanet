BEGIN;

UPDATE storage.buckets
SET public = false,
    file_size_limit = 20971520,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png'
    ]
WHERE id = 'hr-files';

DROP POLICY IF EXISTS storage_hr_files_upload ON storage.objects;
DROP POLICY IF EXISTS storage_hr_files_insert_scoped ON storage.objects;
DROP POLICY IF EXISTS storage_hr_files_delete_scoped ON storage.objects;

CREATE POLICY storage_hr_files_insert_scoped ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'hr-files'
  AND split_part(name, '/', 1) IN ('documents', 'payslips')
  AND split_part(name, '/', 2) = public.get_user_company_id()::text
  AND public.stage32_can_manage_company(public.get_user_company_id())
  AND (
    split_part(name, '/', 1) = 'documents'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id::text = split_part(name, '/', 3)
        AND p.company_id = public.get_user_company_id()
    )
  )
);

CREATE POLICY storage_hr_files_delete_scoped ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'hr-files'
  AND split_part(name, '/', 1) IN ('documents', 'payslips')
  AND split_part(name, '/', 2) = public.get_user_company_id()::text
  AND public.stage32_can_manage_company(public.get_user_company_id())
);

COMMIT;
