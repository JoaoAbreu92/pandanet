import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let envContent = '';
if (fs.existsSync('/root/pandanet/.env.production')) {
    envContent = fs.readFileSync('/root/pandanet/.env.production', 'utf8');
} else if (fs.existsSync('/root/pandanet/.env.local')) {
    envContent = fs.readFileSync('/root/pandanet/.env.local', 'utf8');
}
let SUPABASE_URL = 'http://127.0.0.1:8000';
let SUPABASE_ANON_KEY = '';
envContent.split('\n').forEach(line => {
    if (line.startsWith('SUPABASE_URL=')) SUPABASE_URL = line.split('=')[1].trim();
    if (line.startsWith('SUPABASE_ANON_KEY=') || line.startsWith('VITE_SUPABASE_ANON_KEY=')) SUPABASE_ANON_KEY = line.split('=')[1].trim();
});
if (SUPABASE_URL.includes('supabase-kong')) SUPABASE_URL = 'http://127.0.0.1:8000';

if (!SUPABASE_ANON_KEY) SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.Wl64243gJ9BWjO_VI9ofW7lynhzrnNO6nvDmeXOnQ3I';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testRLS() {
    console.log("=== FRONTEND TEST: LENDO O PROPRIO PERFIL COMO CLIENT ===");
    const { data: { session }, error: authErr } = await supabase.auth.signInWithPassword({
        email: 'ti@acrilight.com.br', password: '123'
    });
    
    if (authErr) {
        console.log("Falha login acrilight: ", authErr.message);
        console.log("Falha no login (senha incorreta?), ignorando teste client-side:", authErr.message);
    } else {
        console.log("Login OK, tentando ler meu próprio profile...");
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();
        console.log("Client Side Read:", profile || error);
    }
}
testRLS();
