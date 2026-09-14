BEGIN;

ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS original_file_name text;

UPDATE public.documents
SET original_file_name = title || '.' || lower(COALESCE(NULLIF(type, ''), 'pdf'))
WHERE original_file_name IS NULL OR btrim(original_file_name) = '';

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documents_original_file_name_length_check'
      AND conrelid = 'public.documents'::regclass
  ) THEN
    ALTER TABLE public.documents
    ADD CONSTRAINT documents_original_file_name_length_check
    CHECK (original_file_name IS NULL OR char_length(original_file_name) <= 255)
    NOT VALID;
  END IF;
END
$block$;

ALTER TABLE public.documents
VALIDATE CONSTRAINT documents_original_file_name_length_check;

COMMIT;
