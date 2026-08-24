
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.Wl64243gJ9BWjO_VI9ofW7lynhzrnNO6nvDmeXOnQ3I';

function decode(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return "Invalid JWT";
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  return payload;
}

console.log(JSON.stringify(decode(anonKey), null, 2));
