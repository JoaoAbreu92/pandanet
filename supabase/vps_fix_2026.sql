-- =============================================================
-- SCRIPT DE ATUALIZAÇÃO DO BANCO DE DADOS - PANDANET & WHATSPANDA
-- Execute este script no SQL Editor do seu Supabase / PostgreSQL
-- =============================================================

-- 1. Tabela whatsapp_conversations (Protocolos e Encerramento)
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS protocol_number VARCHAR(50);
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS protocol_created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS closed_by UUID;
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS termination_reason VARCHAR(255);
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS termination_reason_id UUID;

-- Criar índice para busca rápida por protocolo
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_protocol ON whatsapp_conversations(protocol_number);

-- 2. Tabela whatsapp_settings (Configurações Gerais, Mensagens e Toggles)
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS enable_away_message BOOLEAN DEFAULT true;
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS enable_close_message BOOLEAN DEFAULT true;
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS away_message TEXT;
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS close_message TEXT;
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS reject_calls BOOLEAN DEFAULT false;
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS rejection_message TEXT;
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS auto_assign BOOLEAN DEFAULT false;
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS isolate_chat_history BOOLEAN DEFAULT false;
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS chatbot_delay INTEGER DEFAULT 0;
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS transfer_message_client TEXT;
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS transfer_message_agent TEXT;
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS send_transfer_message_to_client BOOLEAN DEFAULT true;
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS keyword_transfers JSONB DEFAULT '[]'::jsonb;

-- 3. Tabela form_submissions (Solicitação de Reembolso e Anexos no RH)
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS attachment_name TEXT;
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS sector_manager VARCHAR(255);
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS employee_manager VARCHAR(255);

-- 4. Tabela whatsapp_messages (Garantir suporte a mídias e IDs de mensagem)
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_type VARCHAR(50);
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS whatsapp_message_id VARCHAR(255);

-- Criar índice para evitar duplicidade de mensagens
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wa_id ON whatsapp_messages(whatsapp_message_id);

-- 5. Tabela whatsapp_contacts (Colunas para cadastro e vinculação de contatos)
ALTER TABLE whatsapp_contacts ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE whatsapp_contacts ADD COLUMN IF NOT EXISTS queue_id UUID;
ALTER TABLE whatsapp_contacts ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE whatsapp_contacts ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE whatsapp_contacts ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE whatsapp_contacts ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
ALTER TABLE whatsapp_contacts ADD COLUMN IF NOT EXISTS ignore_contact BOOLEAN DEFAULT false;
ALTER TABLE whatsapp_contacts ADD COLUMN IF NOT EXISTS disable_transcription BOOLEAN DEFAULT false;
ALTER TABLE whatsapp_contacts ADD COLUMN IF NOT EXISTS disable_kanban BOOLEAN DEFAULT false;

-- 6. CORREÇÃO DE POLÍTICA RLS (Row Level Security) - RESOLVER ERRO DE TRANSFERÊNCIA DE ATENDIMENTOS
DROP POLICY IF EXISTS "Users can view conversations" ON whatsapp_conversations;
DROP POLICY IF EXISTS "Users can update conversations" ON whatsapp_conversations;
DROP POLICY IF EXISTS "Users see conversations from their department or assigned to them" ON whatsapp_conversations;
DROP POLICY IF EXISTS "Allow company users to update conversations" ON whatsapp_conversations;

CREATE POLICY "Users can view conversations"
  ON whatsapp_conversations
  FOR SELECT
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can update conversations"
  ON whatsapp_conversations
  FOR UPDATE
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- Confirmação
SELECT 'Atualização completa de tabelas, colunas e permissões RLS concluída com sucesso!' AS resultado;
