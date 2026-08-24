/**
 * fix_admin_deployinfo.js
 * Updates the existing admin@deployinfo.com.br profile to link it to Deployinfo and set status to pending.
 */

const supabaseUrl = 'http://77.37.43.60:8000';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.qCZ-7mxAsMtLJDBKicjET6woXEXLm32izoPLqgDHIZg';

const headers = {
  'Content-Type': 'application/json',
  'apikey': serviceKey,
  'Authorization': `Bearer ${serviceKey}`
};

async function execSQL(sql) {
  const res = await fetch(`${supabaseUrl}/pg/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: sql })
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

async function run() {
  console.log('=== Fixing admin@deployinfo.com.br profile on VPS ===');
  
  const res = await execSQL(`
    UPDATE public.profiles
    SET 
      company_id = '3e9daa63-f8b8-459e-a36c-2dad9ced077b',
      status = 'pending',
      role = 'Colaborador',
      is_company_admin = false,
      is_admin = false
    WHERE email = 'admin@deployinfo.com.br';
  `);
  
  console.log('Status:', res.status);
  console.log('Response:', res.body);
  
  // Reload schema
  await execSQL("NOTIFY pgrst, 'reload schema';");
  console.log('Schema reloaded!');
}

run().catch(console.error);
