const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Edge Function 'email-handler' V8 (Minimal) iniciada.");

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    console.log("Recebido:", JSON.stringify(body, null, 2));

    return new Response(JSON.stringify({
      success: true,
      message: 'Comunicação ok! Teste minimalista.',
      received_action: body.action
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    })
  }
})
