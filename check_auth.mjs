
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'http://77.37.43.60:8000';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.qCZ-7mxAsMtLJDBKicjET6woXEXLm32izoPLqgDHIZg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAuthUsers() {
    let output = "--- AUTH USERS CHECK ---\n\n";

    try {
        // Tentar ver se conseguimos rodar um SQL simples via RPC ou similar se existir
        // Caso contrário, vamos apenas tentar listar via Admin API para ver se OS IDs batem
        const { data: { users }, error } = await supabase.auth.admin.listUsers();

        if (error) {
            output += `Error listing users: ${error.message}\n`;
        } else {
            output += `Found ${users.length} users in Auth.\n`;
            for (const user of users) {
                output += `ID: ${user.id} | Email: ${user.email}\n`;
            }
        }

    } catch (e) {
        output += `FATAL ERROR: ${e.message}\n`;
    }

    fs.writeFileSync('auth_check.txt', output);
    console.log("Check complete.");
}

checkAuthUsers();
