
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zeczodrgytxqesojpuds.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplY3pvZHJneXR4cWVzb2pwdWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NDMxMjMsImV4cCI6MjA3ODAxOTEyM30.QZFvswt6rCFU6LqMBw221G9u9vXCWO4J_Taktj2hlu4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createMasterUser() {
    const email = 'ti@grupopixel.com.br';
    const password = 'JoaoRAEMarianaGK$2';

    console.log(`Attempting to sign up master user: ${email}`);

    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                full_name: 'Master TI',
                role: 'SaaS Admin',
                is_admin: true,
            }
        }
    });

    if (error) {
        console.error('Error creating user:', error.message);
        if (error.message.includes('already registered')) {
            console.log('User already exists (likely logged in/signed up previously).');
            // We could try to sign in to verify password but that might fail if email confirm is needed.
            // Assuming handled.
        }
    } else {
        console.log('User created successfully:', data.user?.id);
    }
}

createMasterUser();
