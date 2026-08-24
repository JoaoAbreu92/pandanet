const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listFiles() {
    console.log('Listing files in bucket chat-media...');
    const { data, error } = await supabase.storage
        .from('chat-media')
        .list('', { limit: 10 });

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Files:', data);
        if (data && data.length > 0) {
            console.log('Checking first file public url...');
            const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(data[0].name);
            console.log('Public URL:', publicUrl);
        }
    }
}

listFiles();
