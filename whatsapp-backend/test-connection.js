const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SECRET = 'your-super-secret-jwt-token-with-at-least-32-characters-long';
const SUPABASE_URL = 'http://77.37.43.60:8000';

function sign(payload, secret) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto.createHmac('sha256', secret).update(signatureInput).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${signatureInput}.${signature}`;
}

const now = Math.floor(Date.now() / 1000) - 3600; // Subtract 1 hour to handle clock skew
const servicePayload = {
    role: 'service_role',
    iss: 'supabase',
    iat: now,
    exp: now + (60 * 60 * 24 * 365) // 1 year
};

const freshKey = sign(servicePayload, SECRET);

console.log('--- TESTING FRESH KEY ---');
console.log(`URL: ${SUPABASE_URL}`);
console.log(`Secret Used: ${SECRET.substring(0, 10)}...`);
console.log(`Generated Key: ${freshKey.substring(0, 20)}...`);

const supabase = createClient(SUPABASE_URL, freshKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function test() {
    console.log('Attemping connection...');
    const { data, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
        console.error('❌ Connection Failed:', error.message);
        if (error.status === 401) {
            console.error('   -> The Secret is definitely wrong or the server is rejecting the signature.');
        }
    } else {
        console.log('✅ SUCCESS! Connection Established.');
        console.log(`   Total Users: ${data.users.length}`);
        
        // Find existing users
        const emails = data.users.map(u => u.email);
        console.log('   Users:', emails.join(', '));
        
        // Save working key
        const fs = require('fs');
        const anonPayload = { ...servicePayload, role: 'anon' };
        const anonKey = sign(anonPayload, SECRET);
        
        const envContent = `SUPABASE_URL=${SUPABASE_URL}\nSUPABASE_SERVICE_KEY=${freshKey}`;
        fs.writeFileSync('.env.working', envContent);
        console.log('   -> Saved working configuration to .env.working');
    }
}

test();
