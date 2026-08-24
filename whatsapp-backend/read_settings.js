const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://77.37.43.60:8000';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.Wl64243gJ9BWjO_VI9ofW7lynhzrnNO6nvDmeXOnQ3I';
const companyId = '56eaa5ed-8d1b-4879-a002-838702eeb14d';

const supabase = createClient(supabaseUrl, anonKey);

async function read() {
  console.log('Lendo configurações de whatsapp_settings do banco...');
  const { data, error } = await supabase
    .from('whatsapp_settings')
    .select('id, connection_name, business_hours, business_hours_start, business_hours_end, away_message')
    .eq('company_id', companyId);

  if (error) {
    console.error('Erro ao ler configurações:', error.message);
  } else {
    console.log('Configurações lidas com sucesso:\n', JSON.stringify(data, null, 2));
  }
}

read().catch(console.error);
