BEGIN;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.documents FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.documents TO authenticated;

DROP POLICY IF EXISTS tenant_isolation_policy ON public.documents;
DROP POLICY IF EXISTS documents_select_scoped ON public.documents;
DROP POLICY IF EXISTS documents_insert_manager ON public.documents;
DROP POLICY IF EXISTS documents_update_manager ON public.documents;
DROP POLICY IF EXISTS documents_delete_manager ON public.documents;

CREATE POLICY documents_select_scoped
ON public.documents
FOR SELECT
TO authenticated
USING (
  is_platform_admin()
  OR (
    company_id = get_user_company_id()
    AND (
      COALESCE(target_type, 'all') = 'all'
      OR (target_type = 'users' AND auth.uid() = ANY(COALESCE(target_users, '{}'::uuid[])))
      OR (
        target_type = 'departments'
        AND EXISTS (
          SELECT 1
          FROM public.profiles profile
          WHERE profile.id = auth.uid()
            AND profile.department_id = ANY(COALESCE(documents.target_departments, '{}'::uuid[]))
        )
      )
      OR is_company_admin_v2(company_id)
    )
  )
);

CREATE POLICY documents_insert_manager
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IS NOT NULL
  AND (is_platform_admin() OR is_company_admin_v2(company_id))
);

CREATE POLICY documents_update_manager
ON public.documents
FOR UPDATE
TO authenticated
USING (is_platform_admin() OR is_company_admin_v2(company_id))
WITH CHECK (
  company_id IS NOT NULL
  AND (is_platform_admin() OR is_company_admin_v2(company_id))
);

CREATE POLICY documents_delete_manager
ON public.documents
FOR DELETE
TO authenticated
USING (is_platform_admin() OR is_company_admin_v2(company_id));

UPDATE storage.buckets
SET public = false,
    file_size_limit = 20971520,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]::text[]
WHERE id = 'documents';

DROP POLICY IF EXISTS storage_documents_upload ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete own documents" ON storage.objects;
DROP POLICY IF EXISTS storage_documents_insert_scoped ON storage.objects;
DROP POLICY IF EXISTS storage_documents_update_scoped ON storage.objects;
DROP POLICY IF EXISTS storage_documents_delete_scoped ON storage.objects;

CREATE POLICY storage_documents_insert_scoped
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (is_platform_admin() OR is_company_admin_v2(get_user_company_id()))
  AND split_part(name, '/', 1) = get_user_company_id()::text
  AND split_part(name, '/', 2) = auth.uid()::text
);

CREATE POLICY storage_documents_update_scoped
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (is_platform_admin() OR owner_id = auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'documents'
  AND (is_platform_admin() OR owner_id = auth.uid()::text)
);

CREATE POLICY storage_documents_delete_scoped
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    is_platform_admin()
    OR owner_id = auth.uid()::text
    OR (
      is_company_admin_v2(get_user_company_id())
      AND split_part(name, '/', 1) = get_user_company_id()::text
    )
  )
);

CREATE INDEX IF NOT EXISTS documents_company_updated_idx
ON public.documents (company_id, updated_at DESC);

COMMIT;
