
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://77.37.43.60:8000';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.Wl64243gJ9BWjO_VI9ofW7lynhzrnNO6nvDmeXOnQ3I';

async function listCompanies() {
  const supabase = createClient(supabaseUrl, anonKey);
  console.log(`Listing companies...`);
  
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, domain');
    
  if (error) {
    console.error("List failed:", error.message);
  } else {
    console.log(`Found ${data.length} companies:`);
    data.forEach(c => console.log(`- ${c.name} (${c.domain}) [ID: ${c.id}]`));
  }
}

listCompanies();
