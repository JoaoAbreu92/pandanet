
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://77.37.43.60:8000';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzA4OTgzMTYsImV4cCI6MjA4NjI1ODMxNn0.19fFdFsT0GDfnHIKASqy9O2pUC8ZB25YUpkDgeCBEzg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verify() {
    console.log('🔍 Buscando perfis no VPS...');
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, company_id, role');

    if (error) {
        console.error('❌ Erro:', error.message);
        return;
    }

    console.log(`✅ Sucesso! Total de perfis encontrados: ${data.length}`);
    data.forEach(p => {
        console.log(`- ${p.full_name} (${p.email}) [ID: ${p.id}] [Company: ${p.company_id}] [Role: ${p.role}]`);
    });

    const testeUser = data.find(u => u.full_name?.toLowerCase().includes('teste') || u.email?.toLowerCase().includes('teste'));
    if (testeUser) {
        console.log('\n🚨 USUÁRIO TESTE ENCONTRADO!');
    } else {
        console.log('\n🤷 Usuário "teste" não encontrado na tabela profiles.');
    }
}

verify();
