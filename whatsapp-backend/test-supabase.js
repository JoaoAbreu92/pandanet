const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

console.log('=== SUPABASE CONNECTION TEST ===');
console.log('URL:', supabaseUrl);
console.log('Key (first 20 chars):', supabaseKey ? supabaseKey.substring(0, 20) + '...' : 'MISSING');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabase() {
    const companyId = '56eaa5ed-8d1b-4879-a002-838702eeb14d';
    
    console.log('\n--- TEST 1: READ ---');
    const { data: readData, error: readError } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .eq('company_id', companyId)
        .single();
    
    console.log('READ Result:');
    console.log('  Data:', readData);
    console.log('  Error:', readError);
    
    console.log('\n--- TEST 2: UPDATE with test QR ---');
    const testQR = 'TEST_QR_CODE_' + Date.now();
    const { data: updateData, error: updateError } = await supabase
        .from('whatsapp_settings')
        .update({ 
            qr_code: testQR,
            updated_at: new Date().toISOString()
        })
        .eq('company_id', companyId)
        .select();
    
    console.log('UPDATE Result:');
    console.log('  Data:', updateData);
    console.log('  Error:', updateError);
    
    if (updateData && updateData.length > 0) {
        console.log('\n✅ UPDATE SUCCESS! QR Code was saved.');
        console.log('  Saved QR:', updateData[0].qr_code);
    } else {
        console.log('\n❌ UPDATE FAILED!');
        if (updateError) {
            console.log('  Error details:', JSON.stringify(updateError, null, 2));
        }
    }
    
    console.log('\n--- TEST 3: READ AGAIN to verify ---');
    const { data: verifyData, error: verifyError } = await supabase
        .from('whatsapp_settings')
        .select('qr_code, updated_at')
        .eq('company_id', companyId)
        .single();
    
    console.log('VERIFY Result:');
    console.log('  QR Code:', verifyData?.qr_code);
    console.log('  Updated At:', verifyData?.updated_at);
    console.log('  Error:', verifyError);
    
    if (verifyData?.qr_code === testQR) {
        console.log('\n🎉 SUCCESS! The QR code was saved and verified in the database!');
    } else {
        console.log('\n❌ VERIFICATION FAILED! The QR code was not saved properly.');
    }
}

testSupabase().catch(err => {
    console.error('\n💥 EXCEPTION:', err);
    process.exit(1);
});
