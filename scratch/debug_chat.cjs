const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Obter URL do .env local do PandaNet
const envPath = path.join(__dirname, '..', '.env');
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
        envVars[key] = value.trim();
    }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
let supabaseKey = envVars['VITE_SUPABASE_ANON_KEY'];

// 2. Tentar achar a SERVICE_ROLE_KEY do Supabase na VPS
const possibleKeyPaths = [
    '/root/supabase/docker/.env',
    '/root/supabase/.env',
    '/home/supabase/docker/.env',
    '/home/ubuntu/supabase/docker/.env',
    path.join(__dirname, '..', '..', 'supabase', 'docker', '.env'),
    path.join(__dirname, '..', '..', 'supabase', '.env'),
];

let serviceRoleKey = null;
for (const pKey of possibleKeyPaths) {
    if (fs.existsSync(pKey)) {
        try {
            const content = fs.readFileSync(pKey, 'utf8');
            const lines = content.split('\n');
            for (const line of lines) {
                if (line.includes('SERVICE_ROLE_KEY=')) {
                    serviceRoleKey = line.split('SERVICE_ROLE_KEY=')[1].trim();
                    // Remover aspas se houver
                    if (serviceRoleKey.startsWith('"') || serviceRoleKey.startsWith("'")) {
                        serviceRoleKey = serviceRoleKey.substring(1, serviceRoleKey.length - 1);
                    }
                    console.log('Encontrada SERVICE_ROLE_KEY em:', pKey);
                    break;
                }
            }
        } catch (e) {
            console.error('Erro ao ler', pKey, e.message);
        }
    }
    if (serviceRoleKey) break;
}

if (serviceRoleKey) {
    supabaseKey = serviceRoleKey;
} else {
    console.log('Aviso: SERVICE_ROLE_KEY nao encontrada. Rodando com ANON_KEY (sujeito a RLS).');
}

console.log('Conectando ao Supabase:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    try {
        const companyId = '56eaa5ed-8d1b-4879-a002-838702eeb14d'; // Grupo Pixel
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

        console.log('\n=== LISTA DE CONVERSAS DO BANCO (SEM RLS SE SERVICE_ROLE ATIVA) ===');
        const { data: convs, error: cErr } = await supabase
            .from('conversations')
            .select('*');
        if (cErr) throw cErr;
        console.log(convs);

        console.log('\n=== TODOS OS PARTICIPANTES DE CONVERSAS DO BANCO ===');
        const { data: parts, error: pErr } = await supabase
            .from('conversation_participants')
            .select('conversation_id, user_id, company_id, profiles(full_name, email)');
        if (pErr) throw pErr;
        console.log(JSON.stringify(parts, null, 2));

        console.log('\n=== BUSCANDO MENSAGENS RECENTES DO BANCO ===');
        const { data: msgs, error: mErr } = await supabase
            .from('messages')
            .select('id, conversation_id, sender_id, text, created_at')
            .order('created_at', { ascending: false })
            .limit(15);
        if (mErr) throw mErr;
        console.log(msgs);

    } catch (err) {
        console.error('Erro na execucao:', err);
    }
}
debug();
