const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://77.37.43.60:8000';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.qCZ-7mxAsMtLJDBKicjET6woXEXLm32izoPLqgDHIZg';

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  // Search for Leandro
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_admin, is_company_admin, company_id, status, permissions')
    .or('full_name.ilike.%leandro%,full_name.ilike.%barros%,email.ilike.%deploy%');

  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  console.log('Profiles found:', JSON.stringify(data, null, 2));

  // Also search by company name DeployInfo
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, domain')
    .or('name.ilike.%deploy%,domain.ilike.%deploy%');
  
  console.log('\nCompanies matching "deploy":', JSON.stringify(companies, null, 2));
}

run().catch(console.error);
