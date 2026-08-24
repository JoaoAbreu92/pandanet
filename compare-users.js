import { createClient } from '@supabase/supabase-js';

const vpsUrl = 'http://77.37.43.60:8000';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzA4NTY4ODcsImV4cCI6MjA4NjIxNjg4N30.RwpD6RdlSxdFcuYcY98NwRfRZLmM-2Ptwpd-KazXPlg';

async function listUsers(url, label) {
    console.log(`\n--- Checking ${label} users at ${url} ---`);
    const supabase = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    try {
        const { data, error } = await supabase.auth.admin.listUsers();
        if (error) {
            console.error(`❌ ${label} Auth Error: status=${error.status} msg=${error.message}`);
        } else {
            console.log(`✅ ${label} Success! Total users: ${data.users.length}`);
            data.users.forEach(u => console.log(`   - ${u.email} (id: ${u.id})`));
        }
    } catch (e) {
        console.error(`❌ ${label} Connection failed: ${e.message}`);
    }
}

async function run() {
    await listUsers(vpsUrl, 'VPS');
    // LOCAL is known to be down from current netstat check, but let's try just in case something changed
    await listUsers('http://localhost:54321', 'LOCAL-54321');
}

run();
