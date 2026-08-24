/**
 * check_create_user_function.js
 * Verifica a versão atual da função create_user_admin no banco VPS
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
  // 1. Check the actual create_user_admin function body on VPS
  const result = await execSQL(`
    SELECT routine_name, routine_definition 
    FROM information_schema.routines 
    WHERE routine_name = 'create_user_admin' 
    AND routine_schema = 'public'
    ORDER BY routine_name;
  `);
  console.log('=== create_user_admin function body ===');
  try {
    const data = JSON.parse(result.body);
    if (Array.isArray(data) && data.length > 0) {
      data.forEach((row, i) => {
        console.log(`\n--- Version ${i+1} ---`);
        console.log('Definition (first 500 chars):', row.routine_definition?.substring(0, 500));
        // Check if it uses the correct prefix
        const def = row.routine_definition || '';
        if (def.includes('extensions.gen_salt')) {
          console.log('\n✓ Uses extensions.gen_salt (CORRECT)');
        } else if (def.includes('gen_salt')) {
          console.log('\n✗ Uses gen_salt WITHOUT extensions prefix (PROBLEM!)');
        }
        if (def.includes('extensions.crypt')) {
          console.log('✓ Uses extensions.crypt (CORRECT)');
        } else if (def.includes('crypt(')) {
          console.log('✗ Uses crypt WITHOUT extensions prefix (PROBLEM!)');
        }
      });
    }
  } catch (e) {
    console.log('Raw response:', result.body.substring(0, 1000));
  }

  // 2. Check if pgcrypto / crypt is available in extensions schema
  const extResult = await execSQL(`
    SELECT extname, extversion FROM pg_extension WHERE extname = 'pgcrypto';
  `);
  console.log('\n=== pgcrypto extension ===');
  try {
    const data = JSON.parse(extResult.body);
    if (data.length > 0) {
      console.log('✓ pgcrypto installed:', data[0]);
    } else {
      console.log('✗ pgcrypto NOT installed!');
    }
  } catch(e) {
    console.log('Raw:', extResult.body.substring(0, 500));
  }
  
  // 3. Check Leandro's current is_admin status
  const leanResult = await execSQL(`
    SELECT id, full_name, is_admin, is_company_admin, role FROM public.profiles 
    WHERE email = 'financeiro@deployinfo.com.br';
  `);
  console.log('\n=== Leandro profile ===');
  try {
    const data = JSON.parse(leanResult.body);
    console.log(data[0] || 'Not found');
  } catch(e) {
    console.log('Raw:', leanResult.body.substring(0, 500));
  }
}

run().catch(console.error);
