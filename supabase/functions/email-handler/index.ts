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

// Helper para verificar DNS
async function verifyHost(host: string) {
  try {
    const ips = await Deno.resolveDns(host, "A");
    return { ok: true, ips };
  } catch {
    try {
      const ips = await Deno.resolveDns(host, "AAAA");
      return { ok: true, ips };
    } catch {
      return { ok: false, error: "DNS inválido." };
    }
  }
}

// Helpers de conexão Socket
async function testConnection(host: string, port: number, timeout = 3000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const conn = await Deno.connect({ hostname: host, port });
    conn.close();
    clearTimeout(id);
    return { ok: true };
  } catch (e: any) {
    clearTimeout(id);
    return { ok: false, error: e.message };
  }
}

async function probeTls(host: string, port: number, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const conn = await Deno.connectTls({ hostname: host, port });
    conn.close();
    clearTimeout(id);
    return { ok: true };
  } catch (e: any) {
    clearTimeout(id);
    return { ok: false, error: e.message };
  }
}

// Helper Brevo API Auth
async function testBrevoAuth(apiKey: string) {
  const response = await fetch('https://api.brevo.com/v3/account', {
    headers: { 'api-key': apiKey }
  });
  if (!response.ok) {
    const data = await response.json();
    return { ok: false, error: data.message || "API Key inválida." };
  }
  const data = await response.json();
  return { ok: true, data };
}

console.log("Edge Function 'email-handler' V38 iniciada.");

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method === 'GET') {
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Edge Function Online (V38). IMAP Sync enabled.' 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    if (req.method !== 'POST') throw new Error(`Método ${req.method} não suportado.`);
    const payload = await req.json().catch(() => ({}));
    const { action, settings } = payload;
    if (!action) throw new Error("Ação ausente.");

    console.log(`[V38] Ação: ${action}`);

    // Configs de Portas
    const smtpPort = Number(settings.smtp_port) || (settings.smtp_ssl ? 465 : 587);
    const imapPort = Number(settings.imap_port) || (settings.imap_ssl ? 993 : 143);
    const useImapSsl = settings.imap_ssl ?? (imapPort === 993);

    let imapPass = settings.pass;
    let smtpPass = settings.pass;
    if (settings.pass?.includes(':')) {
      const parts = settings.pass.split(':');
      imapPass = parts[0];
      smtpPass = parts[1];
    }

    const isBrevo = settings.smtp_host?.includes('brevo');
    const hasBrevoKey = settings.brevo_api_key || smtpPass?.startsWith('xkeysib-');
    const brevoKey = settings.brevo_api_key || (hasBrevoKey ? smtpPass : null);

    // ==========================================
    // TEST-CONNECTION
    // ==========================================
    if (action === 'test-connection') {
      const start = Date.now();
      let smtpResult: any = { status: 'pending' };
      let imapResult: any = { status: 'pending' };

      // Teste Envio
      try {
        if (isBrevo && brevoKey) {
          const auth = await testBrevoAuth(brevoKey);
          smtpResult = auth.ok ? { status: 'fulfilled', value: "Brevo OK" } : { status: 'rejected', reason: new Error(auth.error) };
        } else {
          const p = (smtpPort === 465) ? await probeTls(settings.smtp_host, smtpPort) : await testConnection(settings.smtp_host, smtpPort);
          smtpResult = p.ok ? { status: 'fulfilled', value: "SMTP OK" } : { status: 'rejected', reason: new Error(p.error) };
        }
      } catch (e: any) { smtpResult = { status: 'rejected', reason: e }; }

      // Teste Recebimento
      try {
        const p = useImapSsl ? await probeTls(settings.imap_host, imapPort) : await testConnection(settings.imap_host, imapPort);
        imapResult = p.ok ? { status: 'fulfilled', value: "IMAP OK" } : { status: 'rejected', reason: new Error(p.error) };
      } catch (e: any) { imapResult = { status: 'rejected', reason: e }; }

      if (smtpResult.status === 'fulfilled') {
        const warn = imapResult.status === 'rejected' ? ` (Aviso IMAP: ${imapResult.reason.message})` : "";
        return new Response(JSON.stringify({ success: true, message: `${smtpResult.value}${warn}` }), { headers: corsHeaders });
      }
      return new Response(JSON.stringify({ success: false, error: smtpResult.reason?.message }), { headers: corsHeaders });
    }

    // ==========================================
    // SYNC-EMAILS (Leitura Real)
    // ==========================================
    if (action === 'sync-emails') {
      console.log(`[V38] Sincronizando e-mails para ${settings.user}...`);
      const client = new ImapFlow({
        host: settings.imap_host,
        port: imapPort,
        secure: useImapSsl,
        auth: { user: settings.user, pass: imapPass },
        logger: false,
        tls: { rejectUnauthorized: false, servername: settings.imap_host, minVersion: 'TLSv1.2' },
        connectionTimeout: 15000,
      });

      try {
        await client.connect();
        const lock = await client.getMailboxLock('INBOX');

        const latestMessages = [];
        // Busca 20 mensagens mais recentes
        for await (const message of client.list({ seq: '1:20' }, { envelope: true, bodyStructure: true, preview: true })) {
          latestMessages.push({
            user_id: settings.user_id,
            company_id: settings.company_id,
            from_name: message.envelope.from[0]?.name || message.envelope.from[0]?.address || "Desconhecido",
            from_email: message.envelope.from[0]?.address || "",
            subject: message.envelope.subject || "(Sem Assunto)",
            preview: message.preview || "...",
            content: "", // Conteúdo completo apenas ao abrir o e-mail
            folder: 'inbox',
            is_read: false,
            is_starred: false,
            created_at: message.envelope.date ? message.envelope.date.toISOString() : new Date().toISOString(),
            message_id: message.envelope.messageId || `temp-${Date.now()}-${Math.random()}`
          });
        }
        lock.release();
        await client.logout();

        if (latestMessages.length > 0) {
          const { error: dbError } = await supabase
            .from('emails')
            .upsert(latestMessages, { onConflict: 'message_id' });
          if (dbError) throw dbError;
        }

        return new Response(JSON.stringify({ success: true, count: latestMessages.length }), { headers: corsHeaders });

      } catch (e: any) {
        console.error(`[V38 SYNC FAIL]`, e.message);
        return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ success: true, message: 'V38' }), { headers: corsHeaders });

  } catch (error: any) {
    console.error(`[V38 FATAL]`, error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: corsHeaders });
  }
})
