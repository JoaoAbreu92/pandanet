BEGIN;

ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS connection_state_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS disconnected_at timestamptz;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS delivery_error text;

ALTER TABLE public.whatsapp_scheduled_targets
  ADD COLUMN IF NOT EXISTS evolution_message_id text,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;

UPDATE public.whatsapp_scheduled_targets
SET status = 'pending',
    error_message = 'Envio interrompido anteriormente; recolocado na fila.'
WHERE status = 'sending';

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_delivery_status
  ON public.whatsapp_messages(company_id, delivery_status);

CREATE INDEX IF NOT EXISTS idx_whatsapp_scheduled_targets_retry
  ON public.whatsapp_scheduled_targets(status, last_attempt_at);

COMMIT;
