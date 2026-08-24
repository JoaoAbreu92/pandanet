const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: '/root/pandanet/.env' });

const internalSupabaseUrl = (process.env.SUPABASE_URL || 'http://77.37.43.60:8000')
  .replace('localhost', 'supabase-kong')
  .replace('127.0.0.1', 'supabase-kong')
  .replace('77.37.43.60', 'supabase-kong');

const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(internalSupabaseUrl, supabaseKey.trim());

const evoUrl = 'http://evolution-api:8080';
const evoKey = process.env.EVOLUTION_API_KEY || 'EvolutionPandaSecret123';

async function run() {
  console.log('=== VERIFICANDO CONFIGURAÇÃO DE WEBHOOKS NA EVOLUTION ===');
  
  try {
    const { data: connections, error } = await supabase
      .from('whatsapp_settings')
      .select('id, company_id');
      
    if (error) {
      console.error('Erro ao buscar conexões no banco:', error.message);
      return;
    }
    
    for (const conn of connections) {
      const instanceName = `conn_${conn.id}`;
      console.log(`\nInstância: ${instanceName}`);
      
      try {
        const res = await fetch(`${evoUrl}/webhook/find/${instanceName}`, {
          headers: { 'apikey': evoKey }
        });
        
        if (res.ok) {
          const data = await res.json();
          console.log(`-> Webhooks configurados:`, JSON.stringify(data, null, 2));
        } else {
          console.log(`-> Falha ao consultar webhooks (Status: ${res.status})`);
          try {
            const errBody = await res.json();
            console.log(`   Detalhes:`, errBody);
          } catch(e) {}
        }
      } catch (e) {
        console.error(`-> Erro de rede ao conectar com a Evolution:`, e.message);
      }
    }
  } catch (e) {
    console.error('Erro fatal:', e.message);
  }
}

run();
