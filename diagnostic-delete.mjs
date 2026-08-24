
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://77.37.43.60:8000';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.Wl64243gJ9BWjO_VI9ofW7lynhzrnNO6nvDmeXOnQ3I';
const supabase = createClient(supabaseUrl, anonKey);

const USER_EMAIL_TO_DELETE = 'teste@acrilight.com.br';

async function testDelete() {
  console.log(`Testing deletion for ${USER_EMAIL_TO_DELETE}...`);

  // 1. Find the user ID
  const { data: user, error: findError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .ilike('email', USER_EMAIL_TO_DELETE)
    .maybeSingle();

  if (findError) {
    console.error("Error finding user:", findError.message);
    return;
  }

  if (!user) {
    console.log("User not found or already deleted from profiles table.");
  } else {
    console.log(`Found user: ${user.full_name} [ID: ${user.id}]. Attempting deletion...`);

    // 2. Perform deletion and check affected rows
    // PostgREST returns rows affected only if you ask for it via count: 'exact' or returning data
    const { data, error, count } = await supabase
      .from('profiles')
      .delete({ count: 'exact' })
      .eq('id', user.id);

    if (error) {
      console.error("Deletion failed with error:", error.message);
    } else {
      console.log(`Deletion command executed. Rows affected: ${count}`);
      if (count === 0) {
        console.warn("WARNING: 0 rows deleted. This most likely means RLS is blocking the operation.");
      } else {
        console.log("SUCCESS: User deleted from profiles table.");
      }
    }
  }

  // 3. Check JSONB
  const COMPANY_ID = '6323c46c-f0d1-49af-886a-912efb3c6f41';
  const { data: company } = await supabase.from('companies').select('data').eq('id', COMPANY_ID).single();
  const index = company?.data?.employees?.findIndex(e => e.email.includes(USER_EMAIL_TO_DELETE));
  
  if (index !== undefined && index !== -1) {
    console.log(`User STILL EXISTS in companies JSONB (index ${index}). This explains why they return.`);
  } else {
    console.log("User not found in companies JSONB.");
  }
}

testDelete();
