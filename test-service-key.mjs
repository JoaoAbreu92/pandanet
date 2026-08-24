
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://77.37.43.60:8000';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzA5MDE1NzIsImV4cCI6MjA4NjI2MTU3Mn0.jQJIGgaaJIeUCU5VlM9u5grnIB8t6H1WhLTe_Macb34';

async function testServiceKey() {
  const supabase = createClient(supabaseUrl, serviceKey);
  console.log(`Testing service key...`);
  
  const { data, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error("Auth Admin test failed:", error.message);
  } else {
    console.log(`Auth Admin Success! Found ${data.users.length} users.`);
  }
}

testServiceKey();
