
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://77.37.43.60:8000';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzcwODk4MzE2LCJleHAiOjIwODYyNTgzMTZ9.31ioyQ_DvHDPri6WTuLG6GJUn1NwMC5fFGle23iYitI';
const supabase = createClient(supabaseUrl, anonKey);

const COMPANY_ID = '6323c46c-f0d1-49af-886a-912efb3c6f41'; // Acrilight

async function compare() {
  console.log("--- PROFILES TABLE (Current Content) ---");
  const { data: profiles, error: pError } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('company_id', COMPANY_ID);

  if (pError) console.error("Error profiles:", pError);
  else profiles.forEach(p => console.log(`- ${p.full_name} (${p.email}) [ID: ${p.id}]`));

  console.log("\n--- COMPANY JSONB (Current Content) ---");
  const { data: company, error: cError } = await supabase
    .from('companies')
    .select('data')
    .eq('id', COMPANY_ID)
    .single();

  if (cError) console.error("Error JSONB:", cError);
  else {
    const employees = company?.data?.employees || [];
    employees.forEach(e => console.log(`- ${e.name} (${e.email}) [ID: ${e.id}]`));
  }
}

compare();
