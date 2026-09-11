BEGIN;

ALTER TABLE public.whatsapp_scheduled_targets
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS delivery_confirmed_at timestamptz;

CREATE INDEX IF NOT EXISTS whatsapp_scheduled_targets_evolution_message_idx
  ON public.whatsapp_scheduled_targets (evolution_message_id)
  WHERE evolution_message_id IS NOT NULL;

UPDATE public.whatsapp_scheduled_targets
SET delivery_status = CASE
  WHEN status = 'failed' THEN 'FAILED'
  WHEN status = 'sent' THEN 'PENDING'
  ELSE delivery_status
END
WHERE delivery_status IS NULL;

COMMIT;
