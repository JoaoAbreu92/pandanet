const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://77.37.43.60:8000';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.qCZ-7mxAsMtLJDBKicjET6woXEXLm32izoPLqgDHIZg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'whatsapp_messages' });
  if (error) {
    // If RPC doesn't exist, query via client-side hack if possible or just try inserting them.
    // Wait, let's see if we can do execute_sql via supabase MCP or if we can run it.
    console.error("RPC Error:", error);
  }
  
  // Let's run a direct query to see if we can get columns. Wait, select('*') is already doing it, but let's query pg_attribute
  // Actually, we can run a SQL command by using execute_sql but let's see the schema of execute_sql.
  // The error showed project_id was required. Let's find project_id.
  // Wait, let's try calling execute_sql using supabase-mcp-server with the project_id: 'zeczodrgytxqesojpuds' (mentioned in Compaction summary)
}
run();
