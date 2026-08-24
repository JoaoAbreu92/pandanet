import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Carrega config do server (que é production na vdd)
const envPath = '/root/pandanet/.env.production';
let envContent = '';
if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
} else if (fs.existsSync('/root/pandanet/.env.local')) {
    envContent = fs.readFileSync('/root/pandanet/.env.local', 'utf8');
}

const lines = envContent.split('\n');
let SUPABASE_URL = 'http://127.0.0.1:8000'; // Default docker internal url
let SUPABASE_SERVICE_KEY = '';
let SUPABASE_ANON_KEY = '';

lines.forEach(line => {
    if (line.startsWith('SUPABASE_URL=')) SUPABASE_URL = line.split('=')[1].trim();
    if (line.startsWith('SUPABASE_SERVICE_KEY=')) SUPABASE_SERVICE_KEY = line.split('=')[1].trim();
    if (line.startsWith('SUPABASE_ANON_KEY=')) SUPABASE_ANON_KEY = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) SUPABASE_ANON_KEY = line.split('=')[1].trim();
});

// Forcing Localhost over docker bridge name for script on host
if (SUPABASE_URL.includes('supabase-kong')) {
    SUPABASE_URL = 'http://127.0.0.1:8000';
}

// Forçando keys se estiver vazio (apenas para fallback do script remoto)
if (!SUPABASE_SERVICE_KEY) {
    SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.qCZ-7mxAsMtLJDBKicjET6woXEXLm32izoPLqgDHIZg';
}
if (!SUPABASE_ANON_KEY) {
    SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.Wl64243gJ9BWjO_VI9ofW7lynhzrnNO6nvDmeXOnQ3I';
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runDiagnosis() {
    console.log(`=== DIAGNÓSTICO DO BANCO DE DADOS (PANDANET) ===\nURL: ${SUPABASE_URL}`);

    // 1. Checar Users Existentes na auth.users
    console.log("\n[1] Lendo tabela auth.users...");
    const { data: authUsers, error: errAuth } = await adminClient.auth.admin.listUsers();
    if (errAuth) {
        console.error("  Erro ao ler auth.users:", errAuth);
    } else {
        const pixel = authUsers.users.find(u => u.email === 'ti@grupopixel.com.br');
        const acrilight = authUsers.users.find(u => u.email === 'ti@acrilight.com.br');
        console.log(`  auth.users: Encontrados ${authUsers.users.length} usuários.`);
        console.log(`  - ti@grupopixel: ID = ${pixel?.id} | Found: ${!!pixel}`);
        console.log(`  - ti@acrilight: ID = ${acrilight?.id} | Found: ${!!acrilight}`);
    }

    // 2. Checar Profiles Existentes
    console.log("\n[2] Lendo tabela profiles (Admin)...");
    const { data: profiles, error: errProf } = await adminClient.from('profiles').select('id, email, is_admin, company_id, full_name').in('email', ['ti@grupopixel.com.br', 'ti@acrilight.com.br']);
    
    if (errProf) {
        console.error("  Erro ao ler profiles:", errProf);
    } else {
        console.log(`  profiles: Retornados ${profiles.length}`);
        profiles.forEach(p => {
            console.log(`  - ${p.email} | ID = ${p.id} | admin = ${p.is_admin} | comp = ${p.company_id || 'NULL'}`);
        });
    }

    // 3. Checar Companhias
    console.log("\n[3] Lendo companhias...");
    const { data: comps } = await adminClient.from('companies').select('id, domain').in('domain', ['grupopixel.com.br', 'acrilight.com.br']);
    if (comps) {
        comps.forEach(c => console.log(`  - ${c.domain}: ID = ${c.id}`));
    }
}

runDiagnosis();
