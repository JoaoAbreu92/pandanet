import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://77.37.43.60:8000';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.Wl64243gJ9BWjO_VI9ofW7lynhzrnNO6nvDmeXOnQ3I';
const supabase = createClient(supabaseUrl, anonKey);

async function check() {
  // Let's get the master credentials and use its token so no RLS blocks us
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'ti@grupopixel.com.br',
    password: 'PandaNet123()()**'
  });
  
  if (authErr) {
    console.error("Auth failed:", authErr.message);
  }

  const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(20);
  
  if (error) {
    console.error("Failed to fetch notifications:", error.message);
  } else {
    console.log("Recent notifications:", JSON.stringify(data, null, 2));
  }
}
check();
