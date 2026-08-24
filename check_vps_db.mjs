
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'http://77.37.43.60:8000';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.qCZ-7mxAsMtLJDBKicjET6woXEXLm32izoPLqgDHIZg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    let output = "--- COLUMN NAMES FOR whatsapp_settings ---\n";
    
    // Pegar o primeiro registro para ver as chaves (colunas)
    const { data: settings, error } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .limit(1);

    if (error) {
        output += `Error fetching settings: ${error.message}\n`;
    } else if (settings && settings.length > 0) {
        output += `COLUMNS: ${Object.keys(settings[0]).join(', ')}\n`;
        output += `DATA SAMPLE: ${JSON.stringify(settings[0], null, 2)}\n`;
    } else {
        output += "No settings found to inspect.\n";
    }

    fs.writeFileSync('db_check_columns.txt', output);
    console.log("Results written to db_check_columns.txt");
}

check();
