
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'http://77.37.43.60:8000';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.qCZ-7mxAsMtLJDBKicjET6woXEXLm32izoPLqgDHIZg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const acrilightId = '6323c46c-f0d1-49af-886a-912efb3c6f41';
    let output = "--- RLS AND DB CHECK ---\n";

    // 1. Simular query do frontend (como serviço role, mas vamos ver o que tem)
    const { data: settings } = await supabase
        .from('whatsapp_settings')
        .select('id, is_connected, company_id')
        .eq('company_id', acrilightId)
        .eq('is_connected', true);
    
    output += `Found ${settings?.length || 0} connected settings for Acrilight.\n`;
    if (settings) settings.forEach(s => {
        output += `SETTING | ID: ${s.id} | Company: ${s.company_id} | Connected: ${s.is_connected}\n`;
    });

    // 2. Verificar Políticas de RLS
    // Nota: Como não temos uma RPC pronta para SQL livre, vamos tentar listar as políticas via information_schema se possível
    // Ou usar uma RPC comum se existir. Se não, vamos focar no fato de que se o Service Role vê e o frontend não, é RLS.
    
    output += "\n--- POLICIES (via SQL) ---\n";
    const { data: pgPolicies, error: pErr } = await supabase.rpc('get_raw_sql', { sql_query: "SELECT policyname, tablename, cmd, roles, qual FROM pg_policies WHERE tablename IN ('whatsapp_settings', 'whatsapp_conversations', 'whatsapp_contacts')" });
    
    if (pErr) output += `Error fetching policies: ${pErr.message}\n`;
    if (pgPolicies) {
        pgPolicies.forEach(p => {
             output += `TABLE: ${p.tablename} | POLICY: ${p.policyname} | CMD: ${p.cmd} | ROLES: ${p.roles}\n`;
        });
    }

    fs.writeFileSync('db_check_results_detailed.txt', output);
    console.log("Results written to db_check_results_detailed.txt");
}

check();
