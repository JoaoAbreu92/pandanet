
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://77.37.43.60:8000';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.Wl64243gJ9BWjO_VI9ofW7lynhzrnNO6nvDmeXOnQ3I';

async function findUser(name) {
  const supabase = createClient(supabaseUrl, anonKey);
  console.log(`Searching for "${name}" using Anon Key...`);
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('full_name', `%${name}%`);
    
  if (error) {
    console.error("Search failed:", error.message);
  } else {
    console.log(`Found ${data.length} matches:`);
    data.forEach(u => console.log(JSON.stringify(u, null, 2)));
  }
}

findUser(process.argv[2] || 'teste');
