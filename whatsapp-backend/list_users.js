/**
 * list_users.js
 * Lists users from auth.users and public.profiles on VPS to debug discrepancies.
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
  console.log('=== Checking auth.users and public.profiles on VPS ===');
  
  const res = await execSQL(`
    SELECT u.id as auth_id, u.email as auth_email, p.id as profile_id, p.email as profile_email, p.full_name, p.is_admin, p.is_company_admin, p.role 
    FROM auth.users u 
    LEFT JOIN public.profiles p ON u.id = p.id
    ORDER BY u.email;
  `);
  
  try {
    const data = JSON.parse(res.body);
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('Error parsing:', res.body);
  }
}

run().catch(console.error);
