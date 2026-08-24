
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://77.37.43.60:8000';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.qCZ-7mxAsMtLJDBKicjET6woXEXLm32izoPLqgDHIZg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSearch() {
    const email = 'teste@panda.com.br';
    console.log(`Searching for user with email ${email}...`);
    
    // listUsers doesn't support filtering by email in supabase-js directly in older versions, 
    // but we can list and filter manually if it doesn't error.
    // However, listUsers error'd with "Database error".
    
    // Let's try to get user by email directly if the API supports it (it doesn't in standard helper, but we try anyway)
    // Actually, we can try to find in profiles again and check if the ID is different.
    
    const { data: profs } = await supabase.from('profiles').select('*').eq('email', email);
    console.log("PROFILES FOUND:", profs);
}

testSearch();
