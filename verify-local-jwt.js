import crypto from 'crypto';

const SECRET = 'super-secret-token-pandanet-2026-verified';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzA4NTY4ODcsImV4cCI6MjA4NjIxNjg4N30.RwpD6RdlSxdFcuYcY98NwRfRZLmM-2Ptwpd-KazXPlg';

function verify(token, secret) {
    const [header, payload, signature] = token.split('.');
    const signatureInput = `${header}.${payload}`;
    const expectedSignature = crypto.createHmac('sha256', secret)
        .update(signatureInput)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    
    console.log('Provided Signature:', signature);
    console.log('Computed Signature:', expectedSignature);
    
    if (signature === expectedSignature) {
        console.log('✅ SIGNATURE MATCHES!');
    } else {
        console.log('❌ SIGNATURE MISMATCH!');
    }
}

verify(TOKEN, SECRET);
