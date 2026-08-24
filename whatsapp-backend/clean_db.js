require('dotenv').config({ path: './.env.production' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function clean() {
    let envContent = '';
    const envFile = fs.existsSync('./.env.production') ? './.env.production' : './.env.local';
    try {
        envContent = fs.readFileSync(envFile, 'utf8');
    } catch(e) { console.error('Sem env'); return; }

    let URL = 'http://127.0.0.1:8000';
    let KEY = '';
    envContent.split('\n').forEach(line => {
        if (line.startsWith('VITE_SUPABASE_URL=')) URL = line.split('=')[1].trim();
        if (line.startsWith('SUPABASE_SERVICE_KEY=')) KEY = line.split('=')[1].trim();
        if (line.startsWith('SUPABASE_URL=')) URL = line.split('=')[1].trim();
    });
    if (URL.includes('supabase-kong')) URL = 'http://127.0.0.1:8000';

    const supabase = createClient(URL, KEY);
    console.log('Deletando conversas...');
    const { data, error } = await supabase
        .from('whatsapp_conversations')
        .delete()
        .eq('unread_count', 0)
        .eq('status', 'aberto')
        .is('assigned_to', null);
    
    console.log(error || 'Conversas antigas apagadas com sucesso!');
}
clean();
