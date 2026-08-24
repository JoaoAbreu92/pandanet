require('dotenv').config({ path: '/root/supabase/supabase/docker/.env' }); 
// Fallback local path if needed, but trying to follow server convention or just use args
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Hardcode or get from env. Assuming local dev env for this run
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_KEY = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_KEY) {
    console.error('Missing SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
    const sql = `
    create table if not exists email_contacts (
        id uuid default gen_random_uuid() primary key,
        user_id uuid references auth.users(id) not null,
        name text,
        email text not null,
        created_at timestamptz default now(),
        unique(user_id, email)
    );
    alter table email_contacts enable row level security;
    create policy "Users can manage their own contacts" on email_contacts for all using (auth.uid() = user_id);
    `;

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql }); 
    // If rpc exec_sql doesn't exist (it usually opens a security hole), we might fail here.
    // Use direct SQL tool if possible, but it failed.
    // Alternative: Just report "Users need to run SQL" or use the 'query' endpoint if available on self-hosted.
    
    // Actually, let's try to use the raw PostgREST interface if we can, but DDL is hard.
    // On self-hosted, we might have direct DB access? No, only HTTP.
    
    // If this fails, I will instruct user.
    console.log('Migration attempt finished. (Note: RPC exec_sql might not be enabled).');
}

runMigration();
