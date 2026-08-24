
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://77.37.43.60:8000';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.Wl64243gJ9BWjO_VI9ofW7lynhzrnNO6nvDmeXOnQ3I';
const supabase = createClient(supabaseUrl, anonKey);

const COMPANY_ID = '6323c46c-f0d1-49af-886a-912efb3c6f41'; // Acrilight

async function cleanup() {
  console.log("Starting manual cleanup of phantom users...");

  // 1. Delete "teste" from profiles
  const { error: profileError } = await supabase
    .from('profiles')
    .delete()
    .ilike('email', '%teste@acrilight.com.br%');

  if (profileError) console.error("Error deleting test profiles:", profileError);
  else console.log("Deleted 'teste' users from profiles.");

  // 2. Clean JSONB data
  const { data: company } = await supabase
    .from('companies')
    .select('data')
    .eq('id', COMPANY_ID)
    .single();

  if (company?.data && Array.isArray(company.data.employees)) {
    const originalCount = company.data.employees.length;
    // Filter out "Lorena Milani TEST" (phantom in JSONB) and "teste" (if any)
    const cleanedEmployees = company.data.employees.filter(e => 
        !e.email.includes('teste@') && 
        !e.name.includes('Lorena Milani TEST')
    );

    if (cleanedEmployees.length !== originalCount) {
        await supabase.from('companies').update({
            data: { ...company.data, employees: cleanedEmployees }
        }).eq('id', COMPANY_ID);
        console.log(`Cleaned JSONB: removed ${originalCount - cleanedEmployees.length} phantom entries.`);
    } else {
        console.log("JSONB was already clean or no matches found.");
    }
  }

  console.log("Cleanup complete.");
}

cleanup();
