const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Try to load .env from current dir
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

console.log('--- SUPABASE DB CHECK SCRIPT ---');
console.log('URL:', supabaseUrl);

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing env vars: SUPABASE_URL or SUPABASE_SERVICE_KEY');
    console.log('Ensure you are running this from the whatsapp-backend directory with a valid .env file.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const COMPANY_ID = '56eaa5ed-8d1b-4879-a002-838702eeb14d'; // ID from the screenshots

async function checkSettings() {
    console.log(`Checking settings for company: ${COMPANY_ID}`);
    const { data, error } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .eq('company_id', COMPANY_ID)
        .maybeSingle();

    if (error) {
        console.error('❌ Error fetching:', error);
    } else if (!data) {
        console.log('⚠️ No record found for this company ID');
    } else {
        console.log('✅ Data retrieved successfully');
        console.log('--------------------------------------------------');
        console.log('QR CODE:', data.qr_code ? (data.qr_code.substring(0, 50) + '...') : 'NULL');
        console.log('IS CONNECTED:', data.is_connected);
        console.log('UPDATED AT:', data.updated_at);
        console.log('--------------------------------------------------');

        if (data.qr_code) {
            console.log('🎯 CONCLUSION: QR Code IS in the database.');
        } else {
            console.error('⚠️ CONCLUSION: QR Code is NULL in the database.');
        }
    }
}

checkSettings();
