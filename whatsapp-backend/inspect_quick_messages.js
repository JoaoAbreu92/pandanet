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
const supabase = createClient(internalSupabaseUrl, supabaseKey.trim());

async function run() {
  console.log('=== INSPECCIONANDO COLUNAS DE whatsapp_messages ===');
  try {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .limit(1);
      
    if (error) {
      console.log('Erro ao fazer SELECT *:', error.message);
    } else {
      console.log('SELECT * sucesso! Linhas encontradas:', data.length);
      if (data.length > 0) {
        console.log('Colunas encontradas na linha:', Object.keys(data[0]));
      }
    }

    // Também consultar via RPC se possível, ou ver information_schema
    const { data: cols, error: colsErr } = await supabase
      .rpc('exec_sql', {
        sql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'whatsapp_messages';"
      });
      
    if (colsErr) {
      console.error('Erro ao consultar schemas:', colsErr.message);
    } else {
      console.log('Colunas do Banco de Dados:');
      console.log(cols);
    }

  } catch (e) {
    console.error('Exceção:', e.message);
  }
}

run();
