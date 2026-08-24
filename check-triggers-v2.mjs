
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://77.37.43.60:8000';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.Wl64243gJ9BWjO_VI9ofW7lynhzrnNO6nvDmeXOnQ3I';
const supabase = createClient(supabaseUrl, anonKey);

async function checkTriggers() {
  console.log("Checking triggers on 'profiles' and 'companies'...");
  
  const query = `
    SELECT 
        event_object_table as table_name,
        trigger_name,
        event_manipulation as event,
        action_statement as action,
        action_timing as timing
    FROM information_schema.triggers
    WHERE event_object_table IN ('profiles', 'companies', 'users')
    ORDER BY event_object_table, trigger_name;
  `;

  const { data, error } = await supabase.rpc('execute_sql', { sql_query: query });
  
  if (error) {
    console.error("RPC 'execute_sql' failed:", error.message);
    console.log("Likely 'execute_sql' RPC is not defined. Attempting alternative check via standard RPC if available...");
  } else {
    console.table(data);
  }
}

checkTriggers();
