
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://77.37.43.60:8000';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.Wl64243gJ9BWjO_VI9ofW7lynhzrnNO6nvDmeXOnQ3I';
const supabase = createClient(supabaseUrl, anonKey);

async function checkRLS() {
  console.log("Checking RLS Policies for 'profiles' table...");
  
  const { data, error } = await supabase.rpc('get_policies', { table_name: 'profiles' });
  
  if (error) {
    // Fallback: try to see if we can perform a dummy delete and see the result count
    console.log("RPC 'get_policies' failed. Checking via alternative method...");
    
    // Test if we can see the policy names via another way or just check the current user session
    const { data: session } = await supabase.auth.getSession();
    console.log("Current session user ID:", session?.session?.user?.id);
    
    // We'll use the SQL exec tool if possible, or another script.
  } else {
    console.log("Policies:", JSON.stringify(data, null, 2));
  }
}

checkRLS();
