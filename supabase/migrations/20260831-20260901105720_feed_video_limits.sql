BEGIN;

UPDATE storage.buckets
SET
    file_size_limit = 41943040,
    allowed_mime_types = ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'video/mp4',
        'video/webm',
        'video/quicktime'
    ]::text[]
WHERE id = 'feed-media';

COMMIT;
