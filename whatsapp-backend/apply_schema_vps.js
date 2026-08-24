const fs = require('fs');
const path = require('path');

const supabaseUrl = 'http://localhost:8000'; // Kong is bound to port 8000 on localhost of the VPS
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJleHAiOjIxMDEyNjA0NTh9.kFKsUQWYunRnov72ak3duJaVUWmG1gzoMwwX6yotZ0o';

const headers = {
  'Content-Type': 'application/json',
  'apikey': serviceKey,
  'Authorization': `Bearer ${serviceKey}`
};

async function execSQL(sql) {
  try {
    const res = await fetch(`${supabaseUrl}/pg/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: sql })
    });
    const text = await res.text();
    return { status: res.status, body: text };
  } catch (err) {
    return { status: 500, body: err.message };
  }
}

const migrations = [
  // 1. Column last_message in whatsapp_conversations
  'ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS last_message TEXT;',
  
  // 2. chatbot_delay in whatsapp_settings
  'ALTER TABLE public.whatsapp_settings ADD COLUMN IF NOT EXISTS chatbot_delay INTEGER DEFAULT 0;',
  
  // 3. media_type in whatsapp_scheduled_campaigns
  'ALTER TABLE public.whatsapp_scheduled_campaigns ADD COLUMN IF NOT EXISTS media_type VARCHAR(50) DEFAULT \'image\';',
  
  // 4. whatsapp_quick_messages table
  `CREATE TABLE IF NOT EXISTS public.whatsapp_quick_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
      shortcut TEXT NOT NULL,
      message TEXT NOT NULL,
      is_public BOOLEAN DEFAULT TRUE,
      created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
  );`,
  
  // 5. Chatbot settings additional columns
  'ALTER TABLE public.whatsapp_settings ADD COLUMN IF NOT EXISTS chatbot_max_retries INTEGER DEFAULT 2;',
  'ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS chatbot_retries INTEGER DEFAULT 0;',
  'ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS disable_bot BOOLEAN DEFAULT FALSE;',
  'ALTER TABLE public.whatsapp_settings ADD COLUMN IF NOT EXISTS chatbot_invalid_option_msg TEXT DEFAULT \'Opção inválida. Por favor, escolha uma das opções do menu:\';',
  
  // 6. shared_with column in whatsapp_quick_messages
  'ALTER TABLE public.whatsapp_quick_messages ADD COLUMN IF NOT EXISTS shared_with UUID[] DEFAULT \'{}\';',
  
  // 7. Group access and close/away messages toggles
  'ALTER TABLE public.whatsapp_settings ADD COLUMN IF NOT EXISTS allow_all_groups_access BOOLEAN DEFAULT TRUE;',
  'ALTER TABLE public.whatsapp_settings ADD COLUMN IF NOT EXISTS enable_away_message BOOLEAN DEFAULT TRUE;',
  'ALTER TABLE public.whatsapp_settings ADD COLUMN IF NOT EXISTS enable_close_message BOOLEAN DEFAULT TRUE;',
  'ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS allowed_users UUID[] DEFAULT \'{}\';',
  
  // 8. Reload PostgREST schema cache
  "NOTIFY pgrst, 'reload schema';"
];

async function run() {
  console.log('Starting migrations...');
  for (let i = 0; i < migrations.length; i++) {
    const sql = migrations[i];
    console.log(`Running step ${i + 1}/${migrations.length}...`);
    const res = await execSQL(sql);
    console.log(`Status: ${res.status}`);
    if (res.status !== 200) {
      console.error(`Error details: ${res.body}`);
    }
  }
  console.log('All migration steps processed.');
}

run().catch(console.error);
