const crypto = require('crypto');
const fs = require('fs');

const JWT_SECRET = 'super-secret-token-pandanet-2026-verified';

function generateKey(role) {
    const header = { alg: "HS256", typ: "JWT" };
    const payload = {
        role: role,
        iss: "supabase",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 365 * 10) // 10 years
    };

    const encodeB64Url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url').replace(/=/g, '');
    
    const signatureInput = `${encodeB64Url(header)}.${encodeB64Url(payload)}`;
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(signatureInput).digest('base64url');
    
    return `${signatureInput}.${signature}`;
}

const key = generateKey('service_role');
fs.writeFileSync('generated_service_key.txt', key);
console.log('Key written to generated_service_key.txt');
