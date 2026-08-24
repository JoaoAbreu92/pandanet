import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://77.37.43.60:8000';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzE5NDEwMDEsImV4cCI6MjA4NzMwMTAwMX0.ZqBYgAqgsbwQIgUJvnk57wUlW0aSAYd1wEjn7PsAkn0';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function run() {
    console.log("Buscando usuário: instalacao@acrilight.com.br");
    const { data: usersData, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
        console.error("Erro fatal ao listar auth.users:", error);
        return;
    }
    
    const targetUser = usersData.users.find(u => u.email === 'instalacao@acrilight.com.br');
    if (!targetUser) {
        console.log("Usuário NÃO EXISTE na auth.users!");
    } else {
        console.log("USUÁRIO ENCONTRADO! DADOS COMPLETOS:");
        console.log(JSON.stringify(targetUser, null, 2));
    }
}

run();
