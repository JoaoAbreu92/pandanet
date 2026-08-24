import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://77.37.43.60:8000';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.qCZ-7mxAsMtLJDBKicjET6woXEXLm32izoPLqgDHIZg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProfiles() {
    console.log("=== Verificando Perfil: ti@grupopixel.com.br ===");
    const { data: profile1, error: err1 } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', 'ti@grupopixel.com.br');
    console.log(profile1 || err1);

    console.log("=== Verificando Perfil: ti@acrilight.com.br ===");
    const { data: profile2, error: err2 } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', 'ti@acrilight.com.br');
    console.log(profile2 || err2);
    
    console.log("=== Procurando auth.users com ti... ===");
    const { data: users, error: errUsers } = await supabase.auth.admin.listUsers();
    if(users && users.users) {
        const found = users.users.filter(u => u.email?.startsWith('ti@'));
        console.log(`Encontrado(s) ${found.length} usuários.`);
        found.forEach(u => console.log(u.email));
    } else {
        console.log(errUsers);
    }
}

checkProfiles();
