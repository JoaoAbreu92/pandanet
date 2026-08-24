import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://77.37.43.60:8000';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.Wl64243gJ9BWjO_VI9ofW7lynhzrnNO6nvDmeXOnQ3I';
const supabase = createClient(supabaseUrl, anonKey);

async function check() {
  const query = `
    SELECT *
    FROM information_schema.triggers
    WHERE event_object_table IN ('profiles', 'users');
  `;
  const { data, error } = await supabase.rpc('execute_sql', { sql_query: query });
  
  if (error) {
    console.error("RPC 'execute_sql' failed:", error.message);
  } else {
    console.log("Triggers on profiles/users:");
    console.table(data);
  }

  const queryFuncs = `
     SELECT routine_name, routine_definition 
     FROM information_schema.routines 
     WHERE routine_definition ILIKE '%insert into notifications%' OR routine_definition ILIKE '%insert into public.notifications%';
  `;
  const { data: d2, error: e2 } = await supabase.rpc('execute_sql', { sql_query: queryFuncs });
  if (e2) {
    console.error("Function check failed:", e2.message);
  } else {
    console.log("Functions containing insert into notifications:");
    d2.forEach(f => {
      console.log('--- ' + f.routine_name + ' ---');
      console.log(f.routine_definition);
    });
  }
}
check();
