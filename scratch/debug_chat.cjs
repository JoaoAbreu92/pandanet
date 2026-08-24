const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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
const supabaseAnonKey = envVars['VITE_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debug() {
    try {
        const companyId = '56eaa5ed-8d1b-4879-a002-838702eeb14d'; // Grupo Pixel
        console.log('\n=== BUSCANDO CONVERSAS DA EMPRESA GRUPO PIXEL ===');
        const { data: convs, error: cErr } = await supabase
            .from('conversations')
            .select('*')
            .eq('company_id', companyId);
        if (cErr) throw cErr;
        console.log(convs);

        if (convs.length > 0) {
            const convIds = convs.map(c => c.id);
            console.log('\n=== PARTICIPANTES DESSAS CONVERSAS ===');
            const { data: parts, error: pErr } = await supabase
                .from('conversation_participants')
                .select('conversation_id, user_id, company_id, profiles(full_name, email)')
                .in('conversation_id', convIds);
            if (pErr) throw pErr;
            console.log(JSON.stringify(parts, null, 2));

            console.log('\n=== MENSAGENS DESSAS CONVERSAS ===');
            const { data: msgs, error: mErr } = await supabase
                .from('messages')
                .select('id, conversation_id, sender_id, text, created_at')
                .in('conversation_id', convIds)
                .order('created_at', { ascending: false })
                .limit(10);
            if (mErr) throw mErr;
            console.log(msgs);
        } else {
            console.log('Nenhuma conversa encontrada para a empresa Grupo Pixel.');
        }

    } catch (err) {
        console.error(err);
    }
}
debug();
