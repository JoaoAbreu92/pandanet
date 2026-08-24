
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'http://77.37.43.60:8000';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.qCZ-7mxAsMtLJDBKicjET6woXEXLm32izoPLqgDHIZg';
const supabase = createClient(supabaseUrl, supabaseKey);

const COMPANY_ACRILIGHT = '6323c46c-f0d1-49af-886a-912efb3c6f41';
const COMPANY_PIXEL = '56eaa5ed-8d1b-4879-a002-838702eeb14d';

async function check() {
    let output = `--- DB INSPECTION START ---\n\n`;
    
    for (const [name, id] of [['ACRILIGHT', COMPANY_ACRILIGHT], ['PIXEL', COMPANY_PIXEL]]) {
        output += `=== CHECKING ${name} (${id}) ===\n`;
        
        // Mensagens
        const { data: messages } = await supabase
            .from('whatsapp_messages')
            .select('id, conversation_id, message_text, is_from_customer, created_at')
            .eq('company_id', id)
            .order('created_at', { ascending: false })
            .limit(3);
        output += `RECENT MESSAGES: ${JSON.stringify(messages || [], null, 2)}\n`;

        // Contatos
        const { data: contacts } = await supabase
            .from('whatsapp_contacts')
            .select('id, name, phone, created_at')
            .eq('company_id', id)
            .order('created_at', { ascending: false })
            .limit(3);
        output += `RECENT CONTACTS: ${JSON.stringify(contacts || [], null, 2)}\n`;

        // Configurações
        const { data: settings } = await supabase
            .from('whatsapp_settings')
            .select('id, phone_number, is_connected, connection_name')
            .eq('company_id', id);
        output += `SETTINGS: ${JSON.stringify(settings || [], null, 2)}\n\n`;
    }

    fs.writeFileSync('db_check_comprehensive.txt', output);
    console.log("Check complete.");
}

check();
