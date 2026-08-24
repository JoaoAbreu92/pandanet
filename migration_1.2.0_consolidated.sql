-- ====================================================================
-- MIGRATION SCRIPT - PANDANET VERSION 1.2.0 BETA
-- Consolidated changes applied on the self-hosted VPS PostgreSQL database
-- ====================================================================

-- 1. ESTRUTURA DE TABELAS (COLUNAS NOVAS E TABELAS NOVAS)

-- Mensagens de chat interno: adicionado campo payload para guardar informações adicionais de mídias/mensagens
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT NULL;

-- Campanhas de WhatsApp: adicionada coluna media_type para diferenciar imagens de vídeos
ALTER TABLE public.whatsapp_scheduled_campaigns ADD COLUMN IF NOT EXISTS media_type VARCHAR(50) DEFAULT 'image';

-- Tabela de Mensagens Rápidas do WhatsApp (Quick Messages)
CREATE TABLE IF NOT EXISTS public.whatsapp_quick_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    shortcut TEXT NOT NULL,
    message TEXT NOT NULL,
    is_public BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configurações de limite de tentativas do chatbot e mensagens customizadas
ALTER TABLE public.whatsapp_settings ADD COLUMN IF NOT EXISTS chatbot_max_retries INTEGER DEFAULT 2;
ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS chatbot_retries INTEGER DEFAULT 0;
ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS disable_bot BOOLEAN DEFAULT FALSE;
ALTER TABLE public.whatsapp_scheduled_targets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.whatsapp_scheduled_campaigns ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.whatsapp_settings ADD COLUMN IF NOT EXISTS chatbot_invalid_option_msg TEXT DEFAULT 'Opção inválida. Por favor, escolha uma das opções do menu:';


-- 2. POLITICAS DE SEGURANÇA E RLS (ROW LEVEL SECURITY)

-- Habilitar RLS e criar política de isolamento para Mensagens Rápidas
ALTER TABLE public.whatsapp_quick_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.whatsapp_quick_messages;
CREATE POLICY "tenant_isolation_policy" ON public.whatsapp_quick_messages
    FOR ALL TO authenticated
    USING (company_id = public.get_user_company_id() OR public.is_admin_in_profile())
    WITH CHECK (company_id = public.get_user_company_id() OR public.is_admin_in_profile());

-- Habilitar RLS e criar políticas de isolamento para Campanhas
ALTER TABLE public.whatsapp_scheduled_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.whatsapp_scheduled_campaigns;
CREATE POLICY "tenant_isolation_policy" ON public.whatsapp_scheduled_campaigns
    FOR ALL TO authenticated
    USING (company_id = public.get_user_company_id() OR public.is_admin_in_profile())
    WITH CHECK (company_id = public.get_user_company_id() OR public.is_admin_in_profile());

-- Habilitar RLS e criar políticas de isolamento para Alvos de Campanhas
ALTER TABLE public.whatsapp_scheduled_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.whatsapp_scheduled_targets;
CREATE POLICY "tenant_isolation_policy" ON public.whatsapp_scheduled_targets
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.whatsapp_scheduled_campaigns c
            WHERE c.id = whatsapp_scheduled_targets.campaign_id
              AND (c.company_id = public.get_user_company_id() OR public.is_admin_in_profile())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.whatsapp_scheduled_campaigns c
            WHERE c.id = whatsapp_scheduled_targets.campaign_id
              AND (c.company_id = public.get_user_company_id() OR public.is_admin_in_profile())
        )
    );

-- 3. RECARREGAR CACHE DE SCHEMAS DO POSTGREST
NOTIFY pgrst, 'reload schema';
