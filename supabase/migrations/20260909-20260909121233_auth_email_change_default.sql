BEGIN;

UPDATE auth.users
SET email_change = ''
WHERE email_change IS NULL;

ALTER TABLE auth.users
    ALTER COLUMN email_change SET DEFAULT '';

COMMIT;
