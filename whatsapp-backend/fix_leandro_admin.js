/**
 * fix_leandro_admin.js
 * Verifica e opcionalmente corrige o is_admin do Leandro no banco VPS
 * para que is_admin e is_company_admin sejam consistentes.
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://77.37.43.60:8000';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.qCZ-7mxAsMtLJDBKicjET6woXEXLm32izoPLqgDHIZg';

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  // Get Leandro's current state
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_admin, is_company_admin')
    .eq('email', 'financeiro@deployinfo.com.br')
    .single();

  if (error || !profile) {
    console.error('Error finding Leandro:', error?.message);
    return;
  }

  console.log('Current state of Leandro:');
  console.log('  full_name:', profile.full_name);
  console.log('  email:', profile.email);
  console.log('  role:', profile.role);
  console.log('  is_admin:', profile.is_admin);
  console.log('  is_company_admin:', profile.is_company_admin);
  
  // The frontend fix (Header.tsx) now checks isCompanyAdmin too.
  // But for consistency, we can also set is_admin = true since he's the company admin.
  // This is the user's decision. For now, let's just report the status.

  if (profile.is_company_admin && !profile.is_admin) {
    console.log('\n⚠️  NOTICE: Leandro is_company_admin=true but is_admin=false.');
    console.log('   The Header.tsx fix will show the Admin menu for is_company_admin users.');
    console.log('   Optionally, you could also set is_admin=true for consistency.');
    console.log('   Run the following to set is_admin=true:');
    console.log(`   UPDATE public.profiles SET is_admin = true WHERE id = '${profile.id}';`);
  } else if (profile.is_admin) {
    console.log('\n✓ Leandro has is_admin=true, admin menu should appear.');
  }
}

run().catch(console.error);
