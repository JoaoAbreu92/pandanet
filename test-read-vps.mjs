
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://77.37.43.60:8000';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.Wl64243gJ9BWjO_VI9ofW7lynhzrnNO6nvDmeXOnQ3I';

async function testRead() {
  console.log("Testing READ with ANON KEY from .env.local...");
  const supabase = createClient(supabaseUrl, anonKey);
  
  const { data, error } = await supabase.from('profiles').select('full_name').limit(5);
  
  if (error) {
    console.error("Read failed:", error.message);
  } else {
    console.log("Read successful! Users found:", data.map(u => u.full_name));
  }
}

testRead();
