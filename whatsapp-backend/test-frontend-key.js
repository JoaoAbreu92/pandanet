const { createClient } = require('@supabase/supabase-js');

// Values from .env.local
const supabaseUrl = 'https://zeczodrgytxqesojpuds.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplY3pvZHJneXR4cWVzb2pwdWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NDMxMjMsImV4cCI6MjA3ODAxOTEyM30.QZFvswt6rCFU6LqMBw221G9u9vXCWO4J_Taktj2hlu4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkFrontendConnection() {
    console.log('--- FRONTEND KEY CHECK ---');
    console.log('URL:', supabaseUrl);
    
    try {
        // Try a simple public read (assuming companies is public readable or at least checkable)
        // Or check health
        const { data, error } = await supabase.from('companies').select('id').limit(1);
        
        if (error) {
            console.error('❌ Error fetching with Anon Key:', error);
            console.log('Message:', error.message);
            console.log('Code:', error.code);
            console.log('Details:', error.details);
            console.log('Hint:', error.hint);
        } else {
            console.log('✅ Success! Anon key works.');
            console.log('Data sample:', data);
        }

        // Also check Auth status simply
        const { data: authData, error: authError } = await supabase.auth.getSession();
         if (authError) {
            console.error('❌ Error checking auth session:', authError);
        } else {
            console.log('✅ Auth service reachable.');
        }

    } catch (err) {
        console.error('❌ Unexpected error:', err);
    }
}

checkFrontendConnection();
