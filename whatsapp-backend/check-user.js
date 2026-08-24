const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

console.log('--- DEBUG INFO ---');
console.log('Loaded URL:', supabaseUrl);
console.log('Loaded Key (first 10):', supabaseServiceKey ? supabaseServiceKey.substring(0, 10) + '...' : 'NULL');
console.log('Loaded Key (last 5):', supabaseServiceKey ? supabaseServiceKey.slice(-5) : 'NULL');
console.log('------------------');

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUser() {
    const email = 'ti@grupopixel.com.br';
    console.log(`🔍 Checking for user: ${email} at ${supabaseUrl}`);

    // 1. Health Check
    try {
        console.log(`\n🩺 Testing Auth Health: ${supabaseUrl}/auth/v1/health`);
        const healthRes = await fetch(`${supabaseUrl}/auth/v1/health`);
        console.log(`   Status: ${healthRes.status} ${healthRes.statusText}`);
        const healthText = await healthRes.text();
        console.log(`   Response: ${healthText.substring(0, 100)}`);
    } catch (e) {
        console.log(`   ❌ Connection failed: ${e.message}`);
    }

    // 2. Test Anon Key (if enabled/public)
    // We construct a client with ANON key just to see if it accepts the signature
    // (Even if RLS blocks data, valid signature != Invalid authentication credentials for the *connection*)
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1cGFiYXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NjY2NjY2NjYsImV4cCI6MTk4MjM0NTY3Nn0.2SG-xXqZ0Yf_bC_k1n_q2_3r_4_5_6_7_8_9_0_1';
    console.log(`\n🔑 Testing Anon Key Signature...`);
    const supabaseAnon = createClient(supabaseUrl, anonKey);
    const { data: anonData, error: anonError } = await supabaseAnon.from('companies').select('count').limit(1);
    
    if (anonError) {
        console.log(`   Anon Result: Error ${anonError.code} - ${anonError.message}`);
    } else {
        console.log(`   Anon Result: Success (Signature accepted)`);
    }

    // 3. Admin User List
    console.log(`\n👮 Testing Service Key (Admin)...`);

    // Test CLOUD KEY explicitely
    const cloudKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplY3pvZHJneXR4cWVzb2pwdWRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjQ0MzEyMywiZXhwIjoyMDc4MDE5MTIzfQ.PshrGDwfTVXDfP0zEzs7GEK0O1vwN6ZCBpKiwrUWpHc';
    console.log(`\n🔑 Testing CLOUD KEY against VPS...`);
    const supabaseCloud = createClient(supabaseUrl, cloudKey);
    const { data, error } = await supabaseCloud.auth.admin.listUsers();

    if (error) {
        console.error('❌ Cloud Key Failed:', error.message);
        if (error.cause) console.error('   Cause:', error.cause);
    } else {
        console.log('✅ Cloud Key Success! Total users:', data.users.length);
        const user = data.users.find(u => u.email === email);
        if (user) console.log('✅ USER FOUND:', user.email);
        else console.log('⚠️ User not found in list.');
        return; // Exit if success
    }
    
    // Fallback to Env Key if Cloud Key fails
    console.log(`\n🔑 Testing Env Key against VPS...`);
    // ... rest of logic
    // But since we are debugging, let's just stop here for the Cloud Key check.
}

checkUser();
