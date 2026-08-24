
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://77.37.43.60:8000';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.qCZ-7mxAsMtLJDBKicjET6woXEXLm32izoPLqgDHIZg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const relsToTry = [
        'profiles!assigned_to(id)',
        'profiles(id)',
        'whatsapp_queues(id)',
        'whatsapp_queues!queue_id(id)',
        'departments(id)',
        'departments!queue_id(id)',
        'whatsapp_settings!connection_id(id)',
        'whatsapp_conversation_tags(tag:whatsapp_tags(id))'
    ];

    for (const rel of relsToTry) {
        const { error } = await supabase
            .from('whatsapp_conversations')
            .select(`id, ${rel}`)
            .limit(1);
        console.log(`${rel}: ${error ? 'FAIL (' + error.message + ')' : 'OK'}`);
    }
}

check();
