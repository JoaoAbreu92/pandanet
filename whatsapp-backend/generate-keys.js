// 1. Define the NEW Secret (Simple and controlled)
const crypto = require('crypto');
const fs = require('fs');

const SECRET = 'super-secret-token-pandanet-2026-verified';

function sign(payload, secret) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto.createHmac('sha256', secret).update(signatureInput).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    return `${signatureInput}.${signature}`;
}

const now = Math.floor(Date.now() / 1000);
const anonPayload = {
    role: 'anon',
    iss: 'supabase',
    iat: now,
    exp: now + (60 * 60 * 24 * 365 * 10) // 10 years
};

const servicePayload = {
    role: 'service_role',
    iss: 'supabase',
    iat: now,
    exp: now + (60 * 60 * 24 * 365 * 10) // 10 years
};

const anonKey = sign(anonPayload, SECRET);
const serviceKey = sign(servicePayload, SECRET);

// Save complete .env content for VPS
const vpsEnv = `NODE_ENV=production
PORT=3000

#--- SECRET CONFIG ---
JWT_SECRET=${SECRET}
ANON_KEY=${anonKey}
SERVICE_KEY=${serviceKey}
SERVICE_ROLE_KEY=${serviceKey}
#---------------------

# Internal URL (Container to Container)
SUPABASE_URL=http://kong:8000
SUPABASE_SERVICE_KEY=${serviceKey}

# External URL (Browser)
VITE_SUPABASE_URL=http://77.37.43.60:8000
VITE_SUPABASE_ANON_KEY=${anonKey}

COMPANY_ID=56eaa5ed-8d1b-4879-a002-838702eeb14d
`;

fs.writeFileSync('new_vps_env.txt', vpsEnv);
fs.writeFileSync('keys.txt', `JWT_SECRET=${SECRET}\nANON_KEY=${anonKey}\nSERVICE_KEY=${serviceKey}`);

console.log('✅ Generated new_vps_env.txt and keys.txt');
console.log('Service Key:', serviceKey);
