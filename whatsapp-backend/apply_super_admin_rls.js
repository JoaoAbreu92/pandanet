const supabaseUrl = 'http://77.37.43.60:8000';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.qCZ-7mxAsMtLJDBKicjET6woXEXLm32izoPLqgDHIZg';

const headers = {
  'Content-Type': 'application/json',
  'apikey': serviceKey,
  'Authorization': `Bearer ${serviceKey}`
};

async function execSQL(sql) {
  const res = await fetch(`${supabaseUrl}/pg/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: sql })
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

const sql = `
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
`;

async function run() {
  console.log('Sending SQL to database...');
  const res = await execSQL(sql);
  console.log('Status:', res.status);
  console.log('Response:', res.body);
}

run().catch(console.error);
