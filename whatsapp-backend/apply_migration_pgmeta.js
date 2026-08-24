/**
 * apply_migration_pgmeta.js
 * Aplica a migração usando a API pg-meta do Supabase self-hosted
 * que fica exposta internamente e aceita queries SQL diretas.
 */

const supabaseUrl = 'http://77.37.43.60:8000';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.qCZ-7mxAsMtLJDBKicjET6woXEXLm32izoPLqgDHIZg';

const headers = {
  'Content-Type': 'application/json',
  'apikey': serviceKey,
  'Authorization': `Bearer ${serviceKey}`
};

async function execSQL(sql) {
  // Try pg-meta query endpoint (Supabase self-hosted exposes this via Kong)
  const res = await fetch(`${supabaseUrl}/pg/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: sql })
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

const migrationSQL = `
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
DROP TRIGGER IF EXISTS tr_handle_updated_at_plans ON public.plans;
CREATE TRIGGER tr_handle_updated_at_plans
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
DROP TRIGGER IF EXISTS tr_handle_updated_at_companies ON public.companies;
CREATE TRIGGER tr_handle_updated_at_companies
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
`;

async function run() {
  console.log('Applying migration via pg-meta...');
  const result = await execSQL(migrationSQL);
  console.log('Status:', result.status);
  console.log('Response:', result.body);
}

run().catch(console.error);
