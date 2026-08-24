-- =========================================================================
-- FUNÇÃO AUXILIAR PARA VERIFICAR SE O USUÁRIO É SUPER ADMIN
-- =========================================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role = 'Super Admin' FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- =========================================================================
-- APLICAÇÃO DE POLÍTICA DE BYPASS EM TODAS AS TABELAS DE CHAT E WHATSAPP
-- =========================================================================
DO $$
DECLARE
    t text;
    tables_list text[] := ARRAY[
        'whatsapp_conversations',
        'whatsapp_messages',
        'whatsapp_settings',
        'whatsapp_queues',
        'whatsapp_tags',
        'whatsapp_conversation_tags',
        'whatsapp_quick_answers',
        'whatsapp_flows',
        'whatsapp_flow_nodes',
        'whatsapp_flow_connections',
        'whatsapp_schedules',
        'whatsapp_campaigns',
        'whatsapp_campaign_receivers',
        'chat_termination_reasons',
        'conversations',
        'conversation_participants',
        'messages'
    ];
BEGIN
    FOREACH t IN ARRAY tables_list LOOP
        -- Verifica se a tabela existe na base de dados
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Remove política se já existir para evitar conflitos
            EXECUTE format('DROP POLICY IF EXISTS "Super Admins bypass RLS" ON public.%I', t);
            
            -- Cria a política irrestrita para Super Admins
            EXECUTE format('CREATE POLICY "Super Admins bypass RLS" ON public.%I FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())', t);
        END IF;
    END LOOP;
END $$;
