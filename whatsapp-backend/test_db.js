const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: '/root/pandanet/.env' });

let internalSupabaseUrl = process.env.SUPABASE_URL || '';
if (internalSupabaseUrl.includes('localhost') || internalSupabaseUrl.includes('127.0.0.1') || internalSupabaseUrl.includes('77.37.43.60')) {
  internalSupabaseUrl = internalSupabaseUrl
    .replace('localhost', 'supabase-kong')
    .replace('127.0.0.1', 'supabase-kong')
    .replace('77.37.43.60', 'supabase-kong');
}

const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
console.log('URL do Banco:', internalSupabaseUrl);
console.log('Tamanho da Service Key:', supabaseKey.length);

const supabase = createClient(internalSupabaseUrl, supabaseKey.trim());

async function run() {
  console.log('=== TESTANDO BUSCA DE CONVERSA NO SUPABASE ===');
  const start = Date.now();
  try {
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select('id, contact_phone, connection_id')
      .limit(3);
      
    if (error) {
      console.error('Erro na query:', error.message);
    } else {
      console.log('Sucesso! Conversas encontradas:', data.length);
      console.log('Detalhe:', data);
    }
  } catch (e) {
    console.error('Exceção fatal:', e.message);
  } finally {
    console.log(`Tempo total: ${Date.now() - start}ms`);
  }
}

run();
