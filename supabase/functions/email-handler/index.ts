import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import nodemailer from "npm:nodemailer@6.9.7"
import { ImapFlow } from "npm:imapflow@1.0.141"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Edge Function 'email-handler' iniciada.");

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, settings, emailData } = await req.json()
    console.log(`Ação recebida: ${action}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (action === 'test-connection') {
      console.log("Iniciando teste de conexão SMTP...");
      const transporter = nodemailer.createTransport({
        host: settings.smtp_host,
        port: settings.smtp_port,
        secure: settings.smtp_port === 465,
        auth: {
          user: settings.user,
          pass: settings.pass,
        },
      })

      console.log("Verificando SMTP...");
      await transporter.verify()
      console.log("SMTP verificado com sucesso.");

      console.log("Iniciando teste de conexão IMAP...");
      const client = new ImapFlow({
        host: settings.imap_host,
        port: settings.imap_port,
        secure: settings.use_ssl,
        auth: {
          user: settings.user,
          pass: settings.pass,
        },
        logger: false
      })

      console.log("Conectando ao IMAP...");
      await client.connect()
      console.log("IMAP conectado.");
      await client.logout()
      console.log("IMAP desconectado.");

      return new Response(JSON.stringify({ success: true, message: 'Conectado com sucesso!' }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      })
    }

    if (action === 'send-email') {
      console.log("Enviando e-mail...");
      const transporter = nodemailer.createTransport({
        host: settings.smtp_host,
        port: settings.smtp_port,
        secure: settings.smtp_port === 465,
        auth: {
          user: settings.user,
          pass: settings.pass,
        },
      })

      const info = await transporter.sendMail({
        from: `"${emailData.from_name}" <${emailData.from_email}>`,
        to: emailData.to,
        subject: emailData.subject,
        text: emailData.body,
        html: emailData.body.replace(/\n/g, '<br>'),
      })
      console.log("E-mail enviado:", info.messageId);

      return new Response(JSON.stringify({ success: true, messageId: info.messageId }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      })
    }

    if (action === 'sync-emails') {
      console.log("Iniciando sincronização de e-mails via IMAP...");
      const client = new ImapFlow({
        host: settings.imap_host,
        port: settings.imap_port,
        secure: settings.use_ssl,
        auth: {
          user: settings.user,
          pass: settings.pass,
        },
        logger: false
      })

      await client.connect()
      console.log("IMAP conectado para sincronização.");
      const lock = await client.getMailboxLock('INBOX')
      
      try {
        const messages = []
        console.log("Buscando mensagens...");
        for await (let msg of client.fetch({ last: 20 }, { envelope: true, source: true })) {
          const fromData = msg.envelope.from?.[0]
          const emailEntry = {
            user_id: settings.user_id,
            company_id: settings.company_id,
            from_name: fromData?.name || fromData?.address || 'Remetente Desconhecido',
            from_email: fromData?.address || '',
            subject: msg.envelope.subject || '(Sem assunto)',
            created_at: msg.envelope.date ? msg.envelope.date.toISOString() : new Date().toISOString(),
            is_read: msg.flags?.has('\\Seen') || false,
            folder: 'inbox',
            preview: msg.envelope.subject || '',
            content: msg.envelope.subject || '',
            is_starred: msg.flags?.has('\\Flagged') || false
          }
          messages.push(emailEntry)
        }
        console.log(`${messages.length} mensagens encontradas.`);

        if (messages.length > 0) {
          console.log("Realizando upsert no Supabase...");
          const { error: insertError } = await supabase
            .from('emails')
            .upsert(messages, { onConflict: 'user_id, subject, created_at' })

          if (insertError) {
            console.error("Erro no upsert:", insertError);
            throw insertError;
          }
          console.log("Upsert concluído.");
        }

        return new Response(JSON.stringify({ success: true, count: messages.length }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        })
      } finally {
        lock.release()
        await client.logout()
        console.log("Conexão IMAP encerrada.");
      }
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), { 
      status: 400, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    })
  } catch (error: any) {
    console.error('ERRO NA EDGE FUNCTION:', error)
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || String(error) || 'Erro desconhecido na Edge Function',
      details: error.stack || null
    }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    })
  }
})
