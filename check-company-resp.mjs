
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://77.37.43.60:8000';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.Wl64243gJ9BWjO_VI9ofW7lynhzrnNO6nvDmeXOnQ3I';
const supabase = createClient(supabaseUrl, anonKey);

const COMPANY_ID = '6323c46c-f0d1-49af-886a-912efb3c6f41';

async function checkResponsible() {
  const { data: company, error } = await supabase
    .from('companies')
    .select('id, domain, responsible_email, responsible_name')
    .eq('id', COMPANY_ID)
    .single();

  if (error) {
    console.error("Error fetching company:", error.message);
  } else {
    console.log(JSON.stringify(company, null, 2));
  }
}

checkResponsible();
