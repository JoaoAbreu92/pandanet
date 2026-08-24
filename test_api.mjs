import fetch from 'node-fetch';

async function testBackend() {
    try {
        console.log('Sending request...');
        const res = await fetch('https://pandanet.grupopixel.com.br/api/sessions/56eaa5ed-8d1b-4879-a002-838702eeb14d/start/test-conn', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.Wl64243gJ9BWjO_VI9ofW7lynhzrnNO6nvDmeXOnQ3I'
            }
        });
        const text = await res.text();
        console.log('Status HTTP:', res.status);
        console.log('Body:', text);
    } catch (e) {
        console.log('Erro de Request:', e.message);
    }
}
testBackend();
