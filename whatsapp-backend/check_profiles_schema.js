/**
 * check_profiles_schema.js
 * Inspects the columns of the profiles table.
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
  console.log('=== Columns of public.profiles ===');
  const res = await execSQL(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' AND table_schema = 'public'
    ORDER BY column_name;
  `);
  try {
    const data = JSON.parse(res.body);
    console.log(data);
  } catch (e) {
    console.log('Error parsing:', res.body);
  }
}

run().catch(console.error);
