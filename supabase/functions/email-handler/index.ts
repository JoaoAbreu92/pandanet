import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import nodemailer from "nodemailer"
import { ImapFlow } from "imapflow"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Edge Function 'email-handler' V10 (Full) iniciada.");

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, settings } = await req.json()

    if (action === 'test-connection') {
      console.log("Testando conexão para:", settings.user);

      // Teste SMTP
      const transporter = nodemailer.createTransport({
        host: settings.smtp_host,
        port: settings.smtp_port,
        secure: settings.smtp_port === 465,
        auth: {
          user: settings.user,
          pass: settings.pass,
        },
        tls: {
          rejectUnauthorized: false
        }
      })

      await transporter.verify()
      console.log("SMTP OK");

      // Teste IMAP
      const client = new ImapFlow({
        host: settings.imap_host,
        port: settings.imap_port,
        secure: true,
        auth: {
          user: settings.user,
          pass: settings.pass,
        },
        logger: false,
        tls: {
          rejectUnauthorized: false
        }
      })

      await client.connect()
      await client.logout()
      console.log("IMAP OK");

      return new Response(JSON.stringify({
        success: true,
        message: 'Conexão SMTP e IMAP estabelecida com sucesso!'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true, 
      message: 'Ação recebida: ' + action 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error: any) {
    console.error("Erro na função:", error.message);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
