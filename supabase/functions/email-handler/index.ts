import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// Inicializa cliente Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceRole);

// Helpers de conexão Socket com logs
async function testConnection(host: string, port: number, timeout = 5000) {
  try {
    const conn = await Deno.connect({ hostname: host, port });
    conn.close();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

async function probeTls(host: string, port: number, timeout = 5000) {
  try {
    const conn = await Deno.connectTls({ hostname: host, port });
    conn.close();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

async function testBrevoAuth(apiKey: string) {
  const response = await fetch('https://api.brevo.com/v3/account', {
    headers: { 'api-key': apiKey }
  });
  return { ok: response.ok, status: response.status };
}

async function sendEmailBrevo(apiKey: string, sender: string, to: string, subject: string, html: string) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { email: sender },
      to: [{ email: to }],
      subject: subject,
      htmlContent: html
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Brevo API: ${data.message || response.statusText}`);
  }
  return data;
}

console.log("Edge Function 'email-handler' V41 iniciada.");

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let debugLogs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    debugLogs.push(msg);
  };

  try {
    if (req.method === 'GET') {
      return new Response(JSON.stringify({ success: true, message: 'V41 Online' }), { headers: corsHeaders });
    }

    const payload = await req.json().catch(() => ({}));
    const { action, settings, emailData } = payload;
    if (!action) throw new Error("Ação ausente.");

    log(`[V41] Ação iniciada: ${action}`);

    const smtpPort = Number(settings?.smtp_port) || (settings?.smtp_ssl ? 465 : 587);
    const imapPort = Number(settings?.imap_port) || (settings?.imap_ssl ? 993 : 143);
    const useImapSsl = settings?.imap_ssl ?? (imapPort === 993);

    let imapPass = settings?.pass;
    let smtpPass = settings?.pass;
    if (settings?.pass?.includes(':')) {
      const parts = settings.pass.split(':');
      imapPass = parts[0];
      smtpPass = parts[1];
    }

    const isBrevo = settings?.smtp_host?.toLowerCase().includes('brevo');
    const hasBrevoKey = settings?.brevo_api_key || smtpPass?.startsWith('xkeysib-');
    const brevoKey = settings?.brevo_api_key || (hasBrevoKey ? smtpPass : null);

    // ==========================================
    // TEST-CONNECTION
    // ==========================================
    if (action === 'test-connection') {
      log(`Testando SMTP em ${settings.smtp_host}:${smtpPort} (SSL: ${settings.smtp_ssl})`);

      let smtpStatus = "Falhou";
      if (isBrevo && brevoKey) {
        log("Modo Brevo detectado.");
          const auth = await testBrevoAuth(brevoKey);
        if (auth.ok) {
          smtpStatus = "Brevo OK";
          log("Brevo Autenticado com sucesso.");
        } else {
          throw new Error(`Brevo Auth falhou (Status ${auth.status})`);
        }
      } else {
          const p = (smtpPort === 465) ? await probeTls(settings.smtp_host, smtpPort) : await testConnection(settings.smtp_host, smtpPort);
        if (p.ok) {
          smtpStatus = "SMTP Conectado";
          log("Socket SMTP estabelecido.");
        } else {
          throw new Error(`Erro SMTP Socket: ${p.error}`);
        }
      }

      log(`Testando IMAP em ${settings.imap_host}:${imapPort} (SSL: ${useImapSsl})`);
      const imapP = useImapSsl ? await probeTls(settings.imap_host, imapPort) : await testConnection(settings.imap_host, imapPort);
      let imapMsg = imapP.ok ? "IMAP Conectado" : `IMAP Erro: ${imapP.error}`;
      log(imapMsg);

      return new Response(JSON.stringify({
        success: true,
        message: `${smtpStatus} | ${imapMsg}`,
        debug: debugLogs
      }), { headers: corsHeaders });
    }

    // ==========================================
    // SYNC-EMAILS
    // ==========================================
    if (action === 'sync-emails') {
      log(`Iniciando Sincronização IMAP...`);
      const client = new ImapFlow({
        host: settings.imap_host,
        port: imapPort,
        secure: useImapSsl,
        auth: { user: settings.user, pass: imapPass },
        logger: false,
        tls: { rejectUnauthorized: false, servername: settings.imap_host, minVersion: 'TLSv1.2' },
        connectionTimeout: 15000,
      });

      await client.connect();
      log("Conectado ao IMAP para sincronização.");
      const lock = await client.getMailboxLock('INBOX');
      const latestMessages = [];
      log("Listando últimas mensagens...");
      for await (const message of client.list({ seq: '1:20' }, { envelope: true, preview: true })) {
          latestMessages.push({
            user_id: settings.user_id,
            company_id: settings.company_id,
            from_name: message.envelope.from[0]?.name || message.envelope.from[0]?.address || "Desconhecido",
            from_email: message.envelope.from[0]?.address || "",
            subject: message.envelope.subject || "(Sem Assunto)",
            preview: message.preview || "...",
            content: "",
            folder: 'inbox',
            is_read: false,
            created_at: message.envelope.date ? message.envelope.date.toISOString() : new Date().toISOString(),
            message_id: message.envelope.messageId || `temp-${Date.now()}`
          });
      }
      lock.release();
      await client.logout();
      log(`Encontradas ${latestMessages.length} mensagens. Salvando no DB...`);

      if (latestMessages.length > 0) {
        if (!supabaseUrl || !supabaseServiceRole) {
          throw new Error("Configuração interna do Supabase (URL/Key) ausente na Edge Function.");
        }
        const { error: dbError } = await supabase.from('emails').upsert(latestMessages, { onConflict: 'message_id' });
        if (dbError) throw dbError;
      }
      return new Response(JSON.stringify({ success: true, count: latestMessages.length, debug: debugLogs }), { headers: corsHeaders });
    }

    // ==========================================
    // SEND-EMAIL
    // ==========================================
    if (action === 'send-email') {
      if (!emailData) throw new Error("Dados do e-mail ausentes.");
      const { from_email, to, subject, body } = emailData;
      log(`Enviando e-mail para ${to}...`);

      if (isBrevo && brevoKey) {
        log(`Usando Brevo API.`);
        await sendEmailBrevo(brevoKey, from_email || settings.user, to, subject, body);
      } else {
        log(`Usando SMTP Tradicional.`);
        const transporter = nodemailer.createTransport({
          host: settings.smtp_host,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: settings.user, pass: smtpPass },
          tls: { rejectUnauthorized: false }
        });
        await transporter.sendMail({
          from: from_email || settings.user,
          to,
          subject,
          html: body
        });
      }
      log("E-mail enviado com sucesso!");
      return new Response(JSON.stringify({ success: true, message: "Sucesso!", debug: debugLogs }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true, message: 'Ação Processada', debug: debugLogs }), { headers: corsHeaders });

  } catch (error: any) {
    log(`[ERROR] ${error.message}`);
    return new Response(JSON.stringify({ success: false, error: error.message, debug: debugLogs }), { headers: corsHeaders });
  }
})
