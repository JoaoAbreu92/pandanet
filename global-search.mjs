
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://77.37.43.60:8000';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.Wl64243gJ9BWjO_VI9ofW7lynhzrnNO6nvDmeXOnQ3I';
const supabase = createClient(supabaseUrl, anonKey);

async function globalSearch() {
  console.log("Searching for 'ti@acrilight.com.br' globally...");
  
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, company_id, role, is_company_admin')
    .ilike('email', '%ti@acrilight.com.br%');

  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log(JSON.stringify(users, null, 2));
  }
}

globalSearch();
