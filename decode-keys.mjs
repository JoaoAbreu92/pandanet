
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzcwODk4MzE2LCJleHAiOjIwODYyNTgzMTZ9.31ioyQ_DvHDPri6WTuLG6GJUn1NwMC5fFGle23iYitI';

function decode(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return "Invalid JWT";
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  } catch (e) {
    return "Error decoding: " + e.message;
  }
}

console.log("ANON_KEY Payload:", JSON.stringify(decode(token), null, 2));

const serviceToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzA4OTgzMTYsImV4cCI6MjA4NjI1ODMxNn0.19fFdFsT0GDfnHIKASqy9O2pUC8ZB25YUpkDgeCBEzg';
console.log("\nSERVICE_KEY Payload:", JSON.stringify(decode(serviceToken), null, 2));
