import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import nodemailer from "npm:nodemailer@6.9.7"
import { ImapFlow } from "npm:imapflow@1.0.141"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, settings, emailData } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (action === 'test-connection') {
      // Testar SMTP
      const transporter = nodemailer.createTransport({
        host: settings.smtp_host,
        port: settings.smtp_port,
        secure: settings.smtp_port === 465,
        auth: {
          user: settings.user,
          pass: settings.pass,
        },
      })

      await transporter.verify()

      // Testar IMAP
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
      await client.logout()

      return new Response(JSON.stringify({ success: true, message: 'Conectado com sucesso!' }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      })
    }

    if (action === 'send-email') {
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

      return new Response(JSON.stringify({ success: true, messageId: info.messageId }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      })
    }

    if (action === 'sync-emails') {
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
      const lock = await client.getMailboxLock('INBOX')
      
      try {
        const messages = []
        // Buscar as últimas 20 mensagens para sincronização
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

        if (messages.length > 0) {
            const { error: insertError } = await supabase
                .from('emails')
              .upsert(messages, { onConflict: 'user_id, subject, created_at' })

            if (insertError) throw insertError
        }

        return new Response(JSON.stringify({ success: true, count: messages.length }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
        })
      } finally {
        lock.release()
        await client.logout()
      }
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), { 
      status: 400, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    })
  } catch (error: any) {
    console.error('Edge Function Error:', error)
    return new Response(JSON.stringify({ error: error.message || String(error) || 'Erro desconhecido na Edge Function' }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    })
  }
})
