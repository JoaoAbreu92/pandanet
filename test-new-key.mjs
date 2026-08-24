import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://77.37.43.60:8000';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzA4NTY4ODcsImV4cCI6MjA4NjIxNjg4N30.RwpD6RdlSxdFcuYcY98NwRfRZLmM-2Ptwpd-KazXPlg';

async function testNewKey() {
  const supabase = createClient(supabaseUrl, serviceKey);
  console.log('Testing new service key...');
  
  const { data, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error('Test failed:', error.message);
  } else {
    console.log('SUCCESS! Found ' + data.users.length + ' users');
  }
}

testNewKey();
