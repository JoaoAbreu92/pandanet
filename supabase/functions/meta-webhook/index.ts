// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const VERIFY_TOKEN = Deno.env.get('META_VERIFY_TOKEN') || 'my_secure_token_123'; // Chave que vai colocar no facebook

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url);

  // 2. FACEBOOK WEBHOOK VERIFICATION (GET REQUEST)
  // O Facebook envia um GET para verificar se o EndPoint é válido
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK VERIFICADO COM SUCESSO PELA META!');
      return new Response(challenge, { status: 200 }); // O Facebook exige que devolva o challenge em texto limpo
    } else {
      return new Response('Acesso Negado.', { status: 403 });
    }
  }

  // 3. RECEIVING MESSAGES (POST REQUEST)
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      console.log('Mensagem Recebida do Facebook/Instagram:', JSON.stringify(body, null, 2));

      // Verifica se é um evento do Messenger/Insta (page object)
      if (body.object === 'page' || body.object === 'instagram') {
        
        // Inicializa conexão com Supabase usando a Service Role Key (Para ter permissão total de gravar)
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        // O Facebook manda entregas em "entrões" (array entries)
        for (const entry of body.entry) {
          // O ID da página/conta que recebeu a mensagem (útil pra cruzar com whatsapp_settings)
          const pageId = entry.id; 
          
          if(!entry.messaging) continue;

          for (const webhook_event of entry.messaging) {
            
            // É uma mensagem de texto comum?
            if (webhook_event.message && !webhook_event.message.is_echo) {
              const senderId = webhook_event.sender.id;
              const messageText = webhook_event.message.text;

              console.log(`Recebido de ${senderId}: ${messageText}`);

              // TODO: AQUI ACONTECE A INTEGRAÇÃO COM SEU BD PANDANET
              // 1. Busca se esse senderId já tem conversation aberta
              // 2. Se não tiver, cria. Se tiver, atualiza o last_message_at
              // 3. Insere a mensagem na whatsapp_messages
              
              /* EXCEÇÃO DE EXEMPLO PARA O PANDANET: 
              const { data: conv } = await supabase.from('whatsapp_conversations').select('*').eq('contact_phone', senderId).single();
              // Inserindo
              await supabase.from('whatsapp_messages').insert({
                 conversation_id: conv.id,
                 message_text: messageText,
                 is_from_customer: true
              });
              */
            }
          }
        }

        // É crucial retornar 200 OK rapidamente para o Facebook
        // Caso contrário eles reenviam a mensagem repetidamente ou bloqueiam o Webhook
        return new Response('EVENT_RECEIVED', { status: 200 });
      }

    } catch (error) {
      console.error('Erro processando webhook', error);
      return new Response('Bad Request', { status: 400 });
    }
  }

  // Se não foi GET nem POST válido
  return new Response('Not Found', { status: 404 });
})
