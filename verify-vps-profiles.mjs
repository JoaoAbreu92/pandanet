
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://77.37.43.60:8000';
// Key from whatsapp-backend/.env
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzA5MDE1NzIsImV4cCI6MjA4NjI2MTU3Mn0.jQJIGgaaJIeUCU5VlM9u5grnIB8t6H1WhLTe_Macb34';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verify() {
    console.log('🔍 Buscando perfis no VPS (Bypassing RLS)...');
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, email, company_id, role');

        if (error) {
            console.error('❌ Erro Supabase:', error.message);
            return;
        }

        console.log(`✅ Sucesso! Total de perfis encontrados: ${data.length}`);
        data.forEach(p => {
            console.log(`- ${p.full_name} (${p.email}) [ID: ${p.id}] [Company: ${p.company_id}] [Role: ${p.role}]`);
        });

        const testeUser = data.find(u => 
            (u.full_name?.toLowerCase().includes('teste')) || 
            (u.email?.toLowerCase().includes('teste'))
        );
        
        if (testeUser) {
            console.log('\n🚨 USUÁRIO TESTE ENCONTRADO!');
            console.log(JSON.stringify(testeUser, null, 2));
        } else {
            console.log('\n🤷 Usuário "teste" não encontrado na tabela profiles do VPS.');
        }
    } catch (err) {
        console.error('❌ Erro Inesperado:', err.message);
    }
}

verify();
