
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
    console.error('Missing SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
    console.log('Checking table email_contacts...');
    const { data, error } = await supabase.from('email_contacts').select('count', { count: 'exact', head: true });
    if (error) {
        console.error('Check failed:', error.message);
        // If 404 or similar, table doesn't exist
        if (error.code === '42P01') { // undefined_table
            console.error('Table does not exist.');
        }
        process.exit(1);
    } else {
        console.log('Table exists!');
    }
}

check();
