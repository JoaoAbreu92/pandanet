BEGIN;

ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS history_sync_days integer NOT NULL DEFAULT 30;

UPDATE public.whatsapp_settings
SET history_sync_days = LEAST(60, GREATEST(1, COALESCE(history_sync_days, 30)));

ALTER TABLE public.whatsapp_settings
  DROP CONSTRAINT IF EXISTS whatsapp_settings_history_sync_days_check;

ALTER TABLE public.whatsapp_settings
  ADD CONSTRAINT whatsapp_settings_history_sync_days_check
  CHECK (history_sync_days BETWEEN 1 AND 60);

COMMIT;
