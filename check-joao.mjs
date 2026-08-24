
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://77.37.43.60:8000';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.Wl64243gJ9BWjO_VI9ofW7lynhzrnNO6nvDmeXOnQ3I';
const supabase = createClient(supabaseUrl, anonKey);

const EMAIL = 'ti@acrilight.com.br';

async function checkJoao() {
  const { data: user, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('email', EMAIL)
    .maybeSingle();

  if (error) {
    console.error("Error fetching user:", error.message);
  } else {
    console.log(JSON.stringify(user, null, 2));
  }
}

checkJoao();
