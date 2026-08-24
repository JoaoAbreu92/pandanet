/**
 * check_create_admin_safe.js
 * Inspects create_admin_user_for_company_safe function on VPS.
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
  console.log('=== Checking create_admin_user_for_company_safe on VPS ===');
  
  const res = await execSQL(`
    SELECT routine_name, routine_definition 
    FROM information_schema.routines 
    WHERE routine_name = 'create_admin_user_for_company_safe' 
    AND routine_schema = 'public';
  `);
  
  try {
    const data = JSON.parse(res.body);
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('Error parsing:', res.body);
  }
}

run().catch(console.error);
