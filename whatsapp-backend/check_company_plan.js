/**
 * check_company_plan.js
 * Inspects company Deployinfo to see if it has a plan associated with it.
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
  console.log('=== Checking Deployinfo company and its plan on VPS ===');
  
  const res = await execSQL(`
    SELECT c.id, c.name, c.domain, c.plan_id, p.name as plan_name, p.user_limit, p.whatsapp_limit, p.email_limit
    FROM public.companies c
    LEFT JOIN public.plans p ON c.plan_id = p.id
    WHERE c.id = '3e9daa63-f8b8-459e-a36c-2dad9ced077b';
  `);
  
  try {
    const data = JSON.parse(res.body);
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('Error parsing:', res.body);
  }
}

run().catch(console.error);
