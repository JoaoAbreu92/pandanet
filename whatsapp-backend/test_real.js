const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://77.37.43.60:8000';

const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function testReal() {
  const company_id = '6323c46c-f0d1-49af-886a-912efb3c6f41';
  const joaoId = '150bfd35-2f86-4629-b834-69768b613996';
  const keltonId = 'bd6b9e1b-52c0-482a-8caa-96f11677c3fe';

  console.log("Testing conversations insert...");
  const { data, error } = await supabase.from('conversations').insert({
      company_id: company_id,
      is_group: false,
      last_message: 'Conversa iniciada',
      created_by: joaoId
  }).select().single();
  
  if (error) {
      console.log("Error inserting conversation:", error);
  } else {
      console.log("Success! ID:", data.id);
      
      const { data: pData, error: pError } = await supabase.from('conversation_participants').insert([
          { conversation_id: data.id, user_id: joaoId, company_id: company_id },
          { conversation_id: data.id, user_id: keltonId, company_id: company_id }
      ]);
      console.log("Participants result:", pError ? pError : "Success");
  }
}

testReal();
