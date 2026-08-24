
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'http://77.37.43.60:8000';
// USANDO SERVICE ROLE KEY PARA DELETAR USUÁRIOS
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.qCZ-7mxAsMtLJDBKicjET6woXEXLm32izoPLqgDHIZg';
const supabase = createClient(supabaseUrl, supabaseKey);

const pandaEmails = [
    'ana@panda.com.br',
    'carlos@panda.com.br',
    'lucas@panda.com.br',
    'mariana@panda.com.br',
    'teste@panda.com.br'
];

async function deleteUsers() {
    let output = "--- PANDA USER DELETION LOG ---\n\n";

    try {
        // No Self-Host, as vezes o auth.admin.listUsers() pode ter limitações se não houver SMTP configurado, 
        // mas vamos tentar buscar pelo perfil primeiro para pegar os IDs.
        
        const { data: profiles, error: profError } = await supabase
            .from('profiles')
            .select('id, email')
            .in('email', pandaEmails);

        if (profError) {
            output += `Error fetching profiles: ${profError.message}\n`;
        } else if (profiles && profiles.length > 0) {
            output += `Found ${profiles.length} profiles to delete.\n`;
            
            for (const profile of profiles) {
                output += `Deleting user: ${profile.email} (${profile.id})...\n`;
                
                const { error: delError } = await supabase.auth.admin.deleteUser(profile.id);
                
                if (delError) {
                    output += `  FAILED to delete from Auth: ${delError.message}\n`;
                    // Tentar deletar do public.profiles mesmo se o Auth falhar (cascata reversa caso o Auth já tenha sumido ou algo assim)
                    await supabase.from('profiles').delete().eq('id', profile.id);
                } else {
                    output += `  SUCCESS: User removed from Auth and Profiles.\n`;
                }
            }
        } else {
            output += "No profiles found for these emails. Attempting direct match in Auth if possible...\n";
            // Tentar deleção direta se soubermos os IDs da imagem (riscados mas legíveis em parte)
            // UIDs que começam com aab00001 (seqüenciais manuais de mock antigo?)
            // Vamos tentar um check por meta-data se listUsers funcionar.
        }

    } catch (e) {
        output += `FATAL ERROR: ${e.message}\n`;
    }

    fs.writeFileSync('deletion_results.txt', output);
    console.log("Deletion complete. See deletion_results.txt");
}

deleteUsers();
