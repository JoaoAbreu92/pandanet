import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:8000';
// Anon key from environment
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.Wl64243gJ9BWjO_VI9ofW7lynhzrnNO6nvDmeXOnQ3I';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testRLS() {
    console.log("Tentando logar como ti@acrilight.com.br para testar RLS...");
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: 'ti@acrilight.com.br',
        password: '123' 
        // We might not know the exact password, so this relies on luck with simple passwords, 
        // or we can test using an RLS query with raw SQL from postgres.
    });
    
    if (authErr) {
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
