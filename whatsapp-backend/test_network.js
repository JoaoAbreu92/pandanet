const dns = require('dns').promises;
const fetch = require('node-fetch');

async function testUrl(label, url) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    console.log(`[OK] ${label} (${url}) -> Status: ${res.status} (${Date.now() - start}ms)`);
    return true;
  } catch (e) {
    console.log(`[FAIL] ${label} (${url}) -> Erro: ${e.message} (${Date.now() - start}ms)`);
    return false;
  }
}

async function run() {
  console.log('=== DIAGNÓSTICO DE REDE INTERNA DO BACKEND ===');
  
  // 1. Testar resolução de DNS
  const hosts = ['supabase-kong', 'kong', 'supabase-db', 'evolution-api', '77.37.43.60', 'pandanet.grupopixel.com.br'];
  for (const host of hosts) {
    try {
      const ip = await dns.lookup(host);
      console.log(`[DNS] ${host} resolvido para:`, ip.address);
    } catch (e) {
      console.log(`[DNS] ${host} falhou ao resolver:`, e.message);
    }
  }

  console.log('\n--- Testando Conectividade HTTP ---');
  await testUrl('Supabase Kong via Nome', 'http://supabase-kong:8000/rest/v1/');
  await testUrl('Supabase Kong via Servico', 'http://kong:8000/rest/v1/');
  await testUrl('Supabase via IP Publico', 'http://77.37.43.60:8000/rest/v1/');
  await testUrl('Supabase via Dominio Publico', 'https://pandanet.grupopixel.com.br/rest/v1/');
  await testUrl('Evolution API via Nome', 'http://evolution-api:8080/status');
}

run();
