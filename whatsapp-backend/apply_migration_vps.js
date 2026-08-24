/**
 * apply_migration_vps.js
 * Aplica a migração de correção das colunas updated_at nas tabelas plans e companies
 * diretamente no banco VPS via chamadas à API do Supabase.
 * 
 * A Supabase REST API não permite DDL direto, então usamos a função RPC exec_sql
 * se ela existir, ou aplicamos via fetch direto ao endpoint /rest/v1/rpc/
 */

const supabaseUrl = 'http://77.37.43.60:8000';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.qCZ-7mxAsMtLJDBKicjET6woXEXLm32izoPLqgDHIZg';

const headers = {
  'Content-Type': 'application/json',
  'apikey': serviceKey,
  'Authorization': `Bearer ${serviceKey}`
};

async function rpc(fnName, params = {}) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params)
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

// SQL statements to apply
const migrations = [
  {
    name: 'Add updated_at to plans',
    sql: `ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`
  },
  {
    name: 'Add updated_at to companies',
    sql: `ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`
  },
  {
    name: 'Create trigger for plans',
    sql: `
      DROP TRIGGER IF EXISTS tr_handle_updated_at_plans ON public.plans;
      CREATE TRIGGER tr_handle_updated_at_plans
        BEFORE UPDATE ON public.plans
        FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
    `
  },
  {
    name: 'Create trigger for companies',
    sql: `
      DROP TRIGGER IF EXISTS tr_handle_updated_at_companies ON public.companies;
      CREATE TRIGGER tr_handle_updated_at_companies
        BEFORE UPDATE ON public.companies
        FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
    `
  }
];

async function applyMigrations() {
  console.log('=== Applying migrations to VPS database ===\n');

  for (const migration of migrations) {
    console.log(`Applying: ${migration.name}...`);
    
    // Try exec_sql RPC first
    const result = await rpc('exec_sql', { sql: migration.sql });
    
    if (result.status === 200) {
      console.log(`  ✓ Success`);
    } else if (result.status === 404) {
      console.log(`  ✗ exec_sql RPC not found (status 404). Try using pgmeta or psql directly.`);
      console.log(`  SQL to run manually:\n  ${migration.sql.trim()}\n`);
    } else {
      console.log(`  ✗ Failed (status ${result.status}):`, result.body);
      console.log(`  SQL to run manually:\n  ${migration.sql.trim()}\n`);
    }
  }

  // Verify the fix
  console.log('\n=== Verification ===');
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, serviceKey);
  
  for (const table of ['plans', 'companies']) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(`[ERROR] ${table}:`, error.message);
    } else {
      const cols = Object.keys(data[0] || {});
      const hasUpdatedAt = cols.includes('updated_at');
      console.log(`[${hasUpdatedAt ? '✓ FIXED' : '✗ STILL MISSING'}] ${table}`);
    }
  }
}

applyMigrations().catch(console.error);
