/**
 * check_profiles.js
 * Inspects all rows in public.profiles.
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
  console.log('=== All profiles in public.profiles ===');
  const res = await execSQL(`SELECT id, email, full_name, company_id, role, is_admin, is_company_admin FROM public.profiles;`);
  try {
    const data = JSON.parse(res.body);
    console.log(data);
    console.log('Total profiles count:', data.length);
  } catch (e) {
    console.log('Error parsing:', res.body);
  }
}

run().catch(console.error);
