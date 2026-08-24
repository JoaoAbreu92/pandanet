import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'http://77.37.43.60:8000',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.qCZ-7mxAsMtLJDBKicjET6woXEXLm32izoPLqgDHIZg'
);

async function test() {
  const { data, error } = await supabase.from('profiles').select('*').eq('status', 'pending');
  console.log("Pending Users:", data);
  if (error) console.error(error);
}

test();
