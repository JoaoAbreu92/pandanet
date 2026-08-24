
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://77.37.43.60:8000';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.qCZ-7mxAsMtLJDBKicjET6woXEXLm32izoPLqgDHIZg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnostic() {
    console.log('--- Iniciando Diagnóstico de Contatos ---');
    
    // 1. Verificar contatos
    const { data: contacts, error: contactsErr, count } = await supabase
        .from('whatsapp_contacts')
        .select('*', { count: 'exact' });

    if (contactsErr) {
        console.error('Erro ao buscar whatsapp_contacts:', contactsErr.message);
    } else {
        console.log(`Total de contatos: ${count}`);
    }

    // 2. Verificar conversas
    const { data: convs, error: convsErr, count: convsCount } = await supabase
        .from('whatsapp_conversations')
        .select('*', { count: 'exact' });

    if (convsErr) {
        console.error('Erro ao buscar whatsapp_conversations:', convsErr.message);
    } else {
        console.log(`Total de conversas: ${convsCount}`);
    }

    // 3. Verificar estrutura da tabela contacts (via RPC ou simples query)
    const { data: sample, error: sampleErr } = await supabase
        .from('whatsapp_contacts')
        .select('*')
        .limit(1);
    
    if (sample && sample.length > 0) {
        console.log('Exemplo de contato:', JSON.stringify(sample[0], null, 2));
    } else if (!sampleErr) {
        console.log('Tabela whatsapp_contacts está vazia.');
    }
}

diagnostic();
