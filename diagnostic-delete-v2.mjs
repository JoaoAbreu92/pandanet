
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://77.37.43.60:8000';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.Wl64243gJ9BWjO_VI9ofW7lynhzrnNO6nvDmeXOnQ3I';
const supabase = createClient(supabaseUrl, anonKey);

const USER_EMAIL_TO_DELETE = 'teste@acrilight.com.br';

async function testDelete() {
  console.log(`Testing deletion for ${USER_EMAIL_TO_DELETE}...`);

  // 1. Find the user IDs (could be multiple!)
  const { data: users, error: findError } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .ilike('email', USER_EMAIL_TO_DELETE);

  if (findError) {
    console.error("Error finding users:", findError.message);
    return;
  }

  if (!users || users.length === 0) {
    console.log("No users found with this email in profiles table.");
  } else {
    console.log(`Found ${users.length} user(s) matching ${USER_EMAIL_TO_DELETE}.`);
    
    for (const user of users) {
      console.log(`\nAttempting deletion for ID: ${user.id} (${user.full_name})...`);

      const { error, count } = await supabase
        .from('profiles')
        .delete({ count: 'exact' })
        .eq('id', user.id);

      if (error) {
        console.error(`- Deletion failed for ${user.id}:`, error.message);
      } else {
        console.log(`- Deletion command executed. Rows affected: ${count}`);
        if (count === 0) {
          console.warn(`  WARNING: 0 rows deleted for ${user.id}. RLS is likely BLOCKING this.`);
        } else {
          console.log(`  SUCCESS: Row ${user.id} deleted.`);
        }
      }
    }
  }

  // 3. Check JSONB
  const COMPANY_ID = '6323c46c-f0d1-49af-886a-912efb3c6f41';
  const { data: company } = await supabase.from('companies').select('data').eq('id', COMPANY_ID).single();
  const index = company?.data?.employees?.findIndex(e => e.email.includes(USER_EMAIL_TO_DELETE));
  
  if (index !== undefined && index !== -1) {
    console.log(`\nUser STILL EXISTS in companies JSONB (index ${index}). Existing entry detail:`, company.data.employees[index]);
  } else {
    console.log("\nUser not found in companies JSONB.");
  }
}

testDelete();
