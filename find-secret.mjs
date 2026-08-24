
import crypto from 'crypto';

const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.Wl64243gJ9BWjO_VI9ofW7lynhzrnNO6nvDmeXOnQ3I';

const commonSecrets = [
  'super-secret-jwt-key-with-at-least-32-characters-long',
  'super-secret-jwt-key-at-least-32-chars-long',
  'super-secret-jwt-key-must-be-at-least-32-chars-long',
  'super-secret-token-pandanet-2026-verified'
];

function verify(token, secret) {
  const [header, payload, signature] = token.split('.');
  const signatureInput = `${header}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signatureInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  
  return signature === expectedSignature;
}

console.log("Brute-forcing common secrets against working ANON_KEY...");
for (const secret of commonSecrets) {
  if (verify(anonKey, secret)) {
    console.log(`✅ MATCH FOUND! Secret is: ${secret}`);
    process.exit(0);
  }
}

console.log("❌ No match found with common secrets.");
