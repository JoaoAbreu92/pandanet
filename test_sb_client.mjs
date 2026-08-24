import { createClient } from '@supabase/supabase-js';

// 1. Correct ANON KEY
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.Wl64243gJ9BWjO_VI9ofW7lynhzrnNO6nvDmeXOnQ3I';
const URL = 'http://77.37.43.60:8000';

async function test() {
    // 2. Client initialized with the CORRECT anon key (this should work)
    const sb1 = createClient(URL, ANON_KEY, { auth: { persistSession: false } });
    
    // Test if we can fetch something public to prove the key is right
    const { data: d1, error: e1 } = await sb1.from('ai_agents').select('id').limit(1);
    console.log('Test with ANON_KEY:', e1 ? e1.message : 'OK');

    // 3. Client initialized with a WRONG service key (e.g. the one from 2026)
    const WRONG_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzA4OTgzMTYsImV4cCI6MjA4NjI1ODMxNn0.19fFdFsT0GDfnHIKASqy9O2pUC8ZB25YUpkDgeCBEzg';
    const sb2 = createClient(URL, WRONG_SERVICE_KEY, { auth: { persistSession: false } });
    const { data: d2, error: e2 } = await sb2.from('ai_agents').select('id').limit(1);
    console.log('Test with WRONG SERVICE_KEY:', e2 ? e2.message : 'OK');
}
test();
