-- ====================================================================
-- MIGRAÇÃO DE BANCO DE DADOS - NOTIFICAÇÕES PUSH EM SEGUNDO PLANO
-- ====================================================================
-- Execute este script no console de SQL do seu Supabase (self-hosted ou nuvem)
-- para adicionar a coluna de token e habilitar a replicação em tempo real (Realtime).

-- 1. Adicionar coluna push_token na tabela de perfis de usuário
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- 2. Habilitar a replicação em tempo real para as tabelas necessárias
-- Este bloco anônimo garante idempotência (executa sem gerar erro se já existir)
DO $$ 
BEGIN
  -- Tabela: notifications
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  -- Tabela: messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  -- Tabela: whatsapp_messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'whatsapp_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
  END IF;
END $$;
