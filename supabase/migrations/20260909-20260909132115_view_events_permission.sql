BEGIN;

-- Preserve current access for existing users. New users receive the explicit
-- false value from UserManager/AuthContext.
UPDATE public.profiles
SET permissions = jsonb_set(
    COALESCE(permissions, '{}'::jsonb),
    '{viewEvents}',
    'true'::jsonb,
    true
)
WHERE NOT COALESCE(permissions, '{}'::jsonb) ? 'viewEvents';

COMMIT;
