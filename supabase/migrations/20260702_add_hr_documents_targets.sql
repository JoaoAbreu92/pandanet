-- Add targeted sharing columns to hr_documents
ALTER TABLE public.hr_documents ADD COLUMN IF NOT EXISTS target_type VARCHAR DEFAULT 'all';
ALTER TABLE public.hr_documents ADD COLUMN IF NOT EXISTS target_users UUID[] DEFAULT '{}';
ALTER TABLE public.hr_documents ADD COLUMN IF NOT EXISTS target_departments UUID[] DEFAULT '{}';

-- Recreate SELECT policy with targeted sharing
DROP POLICY IF EXISTS "Employees can view public hr documents" ON public.hr_documents;
DROP POLICY IF EXISTS "Employees can view targeted hr documents" ON public.hr_documents;

CREATE POLICY "Employees can view targeted hr documents" ON public.hr_documents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.company_id = hr_documents.company_id
              AND (
                  hr_documents.is_public = true
                  OR hr_documents.target_type = 'all'
                  OR (hr_documents.target_type = 'users' AND p.id = ANY(hr_documents.target_users))
                  OR (hr_documents.target_type = 'departments' AND p.department_id = ANY(hr_documents.target_departments))
                  OR hr_documents.created_by = p.id
                  OR p.is_admin = true
                  OR p.is_company_admin = true
                  OR (p.permissions ->> 'isCompanyAdmin')::boolean = true
              )
        )
    );
