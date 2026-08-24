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
  console.log('Checking for chat_termination_reasons table...');
  const checkRes = await execSQL(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'chat_termination_reasons'
    );
  `);
  console.log('Check Table Status:', checkRes.status);
  console.log('Check Table Response:', checkRes.body);

  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS public.chat_termination_reasons (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Enable RLS
    ALTER TABLE public.chat_termination_reasons ENABLE ROW LEVEL SECURITY;

    -- Add policies
    DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.chat_termination_reasons;
    CREATE POLICY "Enable all access for authenticated users" ON public.chat_termination_reasons
      FOR ALL USING (true) WITH CHECK (true);

    -- Trigger for updated_at
    DROP TRIGGER IF EXISTS tr_handle_updated_at_termination_reasons ON public.chat_termination_reasons;
    CREATE TRIGGER tr_handle_updated_at_termination_reasons
      BEFORE UPDATE ON public.chat_termination_reasons
      FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
  `;

  console.log('Running migration...');
  const migrationRes = await execSQL(createTableSQL);
  console.log('Migration Status:', migrationRes.status);
  console.log('Migration Response:', migrationRes.body);
}

run().catch(console.error);
