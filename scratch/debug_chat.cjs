const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Ler o .env para obter as credenciais de producao na VPS
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
    console.error('Arquivo .env nao encontrado em:', envPath);
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        let key = match[1];
        let value = match[2] || '';
        if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
            value = value.substring(1, value.length - 1);
        }
        if (value.length > 0 && value.charAt(0) === "'" && value.charAt(value.length - 1) === "'") {
            value = value.substring(1, value.length - 1);
        }
        envVars[key] = value.trim();
    }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseAnonKey = envVars['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('URL ou Key do Supabase nao encontrada no .env');
    process.exit(1);
}

console.log('Conectando ao Supabase de Producao:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debug() {
    try {
        console.log('\n=== BUSCANDO PERFIS DE PRODUCAO ===');
        const { data: profiles, error: pError } = await supabase
            .from('profiles')
            .select('id, email, full_name, role, company_id')
            .or('email.eq.ti@grupopixel.com.br,full_name.ilike.%mariana%,email.ilike.%mariana%');
            
        if (pError) throw pError;
        console.log(profiles);

        const masterAdmin = profiles.find(p => p.email === 'ti@grupopixel.com.br');
        const mariana = profiles.find(p => p.full_name.toLowerCase().includes('mariana') || p.email.toLowerCase().includes('mariana'));

        if (!masterAdmin || !mariana) {
            console.log('Perfis necessarios nao encontrados para continuar.');
            return;
        }

        console.log(`\n=== BUSCANDO CONVERSAS DO MASTER ADMIN (${masterAdmin.full_name}) ===`);
        const { data: masterParts, error: mpErr } = await supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', masterAdmin.id);
        if (mpErr) throw mpErr;
        const masterConvIds = masterParts.map(p => p.conversation_id);
        console.log('IDs de conversas do Master Admin:', masterConvIds);

        console.log(`\n=== BUSCANDO CONVERSAS DA MARIANA (${mariana.full_name}) ===`);
        const { data: marianaParts, error: marErr } = await supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', mariana.id);
        if (marErr) throw marErr;
        const marianaConvIds = marianaParts.map(p => p.conversation_id);
        console.log('IDs de conversas da Mariana:', marianaConvIds);

        // Achar interseccao
        const commonConvIds = masterConvIds.filter(id => marianaConvIds.includes(id));
        console.log('\nIDs de conversas em comum:', commonConvIds);

        if (commonConvIds.length > 0) {
            console.log('\n=== DETALHES DAS CONVERSAS EM COMUM ===');
            const { data: convs, error: convError } = await supabase
                .from('conversations')
                .select('*')
                .in('id', commonConvIds);
            if (convError) throw convError;
            console.log(convs);

            console.log('\n=== PARTICIPANTES DAS CONVERSAS EM COMUM ===');
            const { data: allParts, error: allPartsError } = await supabase
                .from('conversation_participants')
                .select('conversation_id, user_id, company_id, profiles(full_name, email)')
                .in('conversation_id', commonConvIds);
            if (allPartsError) throw allPartsError;
            console.log(JSON.stringify(allParts, null, 2));

            console.log('\n=== ULTIMAS 5 MENSAGENS DESSAS CONVERSAS ===');
            const { data: msgs, error: mErr } = await supabase
                .from('messages')
                .select('id, conversation_id, sender_id, text, created_at')
                .in('conversation_id', commonConvIds)
                .order('created_at', { ascending: false })
                .limit(5);
            if (mErr) throw mErr;
            console.log(msgs);
        } else {
            console.log('\nNao ha conversas em comum entre o Master Admin e a Mariana na tabela conversation_participants.');
        }

    } catch (err) {
        console.error('Erro:', err);
    }
}

debug();
