import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Error: Supabase URL or Key not found in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function clearLogo() {
    try {
        console.log('Clearing main_logo setting...');
        const { error } = await supabase
            .from('system_settings')
            .update({ value: null })
            .eq('key', 'main_logo');

        if (error) {
            console.error('Error updating system settings:', error);
        } else {
            console.log('Successfully cleared main_logo setting.');
        }
    } catch (err) {
        console.error('Critical error:', err);
    }
}

clearLogo();
