async function check(url) {
    console.log(`Checking ${url}...`);
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        console.log(`✅ Status: ${response.status}`);
        const text = await response.text();
        console.log(`   Response: ${text.substring(0, 100)}`);
    } catch (err) {
        console.log(`❌ Error: ${err.message}`);
    }
}

console.log('--- CONNECTIVITY TEST ---');
await check('http://77.37.43.60:8000/auth/v1/health');
await check('http://localhost:8000/auth/v1/health');
await check('http://127.0.0.1:8000/auth/v1/health');
await check('http://localhost:54321/auth/v1/health'); // Common supabase port
console.log('--- END TEST ---');
