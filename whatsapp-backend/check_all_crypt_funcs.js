/**
 * check_all_crypt_funcs.js
 * Finds all functions in the database that use gen_salt or crypt.
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
  console.log('=== Checking all functions containing "gen_salt" or "crypt" on VPS ===');
  
  const res = await execSQL(`
    SELECT routine_schema, routine_name, routine_definition 
    FROM information_schema.routines 
    WHERE routine_schema = 'public'
    AND (routine_definition ILIKE '%gen_salt%' OR routine_definition ILIKE '%crypt%');
  `);
  
  try {
    const data = JSON.parse(res.body);
    data.forEach(row => {
      console.log(`\nFunction: ${row.routine_schema}.${row.routine_name}`);
      console.log('Definition Snippet:');
      // Print lines containing gen_salt or crypt
      const lines = row.routine_definition.split('\n');
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes('gen_salt') || line.toLowerCase().includes('crypt')) {
          console.log(`  Line ${idx+1}: ${line.trim()}`);
        }
      });
    });
  } catch (e) {
    console.log('Error parsing:', res.body);
  }
}

run().catch(console.error);
