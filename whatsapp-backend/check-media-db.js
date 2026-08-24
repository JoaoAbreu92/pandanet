const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

console.log('supabaseUrl:', supabaseUrl);
console.log('supabaseKey:', supabaseKey ? 'PRESENT' : 'MISSING');

if (!supabaseUrl) {
    console.error('❌ Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMedia() {
    console.log('Querying recent media messages...');
    const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('id, conversation_id, message_text, media_url, media_type, created_at')
        .not('media_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Results:', JSON.stringify(data, null, 2));
    }
}

checkMedia();
