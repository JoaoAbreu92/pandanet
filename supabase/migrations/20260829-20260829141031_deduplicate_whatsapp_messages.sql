-- Impede que a API de envio e o webhook criem duas linhas
-- para a mesma mensagem da Evolution API.

WITH ranked_messages AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY company_id, whatsapp_message_id
            ORDER BY
                (
                    CASE WHEN media_url IS NOT NULL THEN 1 ELSE 0 END +
                    CASE WHEN message_text IS NOT NULL THEN 1 ELSE 0 END +
                    CASE WHEN sent_by IS NOT NULL THEN 1 ELSE 0 END +
                    CASE WHEN sender_name IS NOT NULL THEN 1 ELSE 0 END
                ) DESC,
                created_at ASC,
                id ASC
        ) AS duplicate_position
    FROM public.whatsapp_messages
    WHERE whatsapp_message_id IS NOT NULL
)
DELETE FROM public.whatsapp_messages AS message
USING ranked_messages AS ranked
WHERE message.id = ranked.id
  AND ranked.duplicate_position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS
    ux_whatsapp_messages_company_wa_id
ON public.whatsapp_messages (
    company_id,
    whatsapp_message_id
);
