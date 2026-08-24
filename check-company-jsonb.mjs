
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://77.37.43.60:8000';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.Wl64243gJ9BWjO_VI9ofW7lynhzrnNO6nvDmeXOnQ3I';

async function checkCompanyData(companyId) {
  const supabase = createClient(supabaseUrl, anonKey);
  console.log(`Fetching data for company: ${companyId}`);
  
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, data')
    .eq('id', companyId)
    .single();
    
  if (error) {
    console.error("Fetch failed:", error.message);
  } else {
    console.log(`Company: ${data.name}`);
    if (data.data && data.data.employees) {
      console.log(`Total employees in JSONB: ${data.data.employees.length}`);
      data.data.employees.forEach(m => console.log(`- ${m.name} (${m.email}) [ID: ${m.id}]`));
    } else {

      console.log("JSONB data.employees is missing or empty.");
    }
  }
}

const cid = process.argv[2] || '6323c46c-f0d1-49af-886a-912efb3cdac0'; // Truncated previously, I hope it works
checkCompanyData(cid);
