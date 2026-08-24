-- Migration to support WhatsPanda privacy and workflow enhancements
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS close_message TEXT DEFAULT '';
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS queue_id UUID REFERENCES whatsapp_queues(id) ON DELETE SET NULL;
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS isolate_chat_history BOOLEAN DEFAULT FALSE;
