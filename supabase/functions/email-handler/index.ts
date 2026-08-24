import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// Helper para verificar se o host existe (DNS)
async function verifyHost(host: string) {
  try {
    const ips = await Deno.resolveDns(host, "A");
    return { ok: true, ips };
  } catch (e: any) {
    try {
      const ips = await Deno.resolveDns(host, "AAAA");
      return { ok: true, ips };
    } catch {
      return { ok: false, error: "Domínio não encontrado ou DNS inválido." };
    }
  }
}

// Helper para testar se uma porta TCP está aberta (Otimizado com timeout)
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

// Helper para testar conectividade pura via TCP/TLS (Nativo Deno)
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

// Helper para enviar e-mail via Brevo API
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
    throw new Error(`Brevo API Error: ${data.message || response.statusText}`);
  }
  return data;
}

// Helper para validar API Key da Brevo
async function testBrevoAuth(apiKey: string) {
  const response = await fetch('https://api.brevo.com/v3/account', {
    headers: { 'api-key': apiKey }
  });
  if (!response.ok) {
    const data = await response.json();
    return { ok: false, error: data.message || "Chave de API inválida." };
  }
  const data = await response.json();
  return { ok: true, data };
}

console.log("Edge Function 'email-handler' V36 iniciada.");

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method === 'GET') {
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Edge Function Online (V36). Brevo & Multi-Pass Supported.'
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    if (req.method !== 'POST') throw new Error(`Método ${req.method} não suportado.`);

    const payload = await req.json().catch(() => ({}));
    const { action, settings } = payload;

    if (!action) throw new Error("Ação não informada.");

    console.log(`[V36] Ação: ${action}`);

    if (action === 'test-connection') {
      if (!settings) throw new Error("Configurações ausentes.");
      const start = Date.now();

      // PROTEÇÃO CONTRA NaN (Causa crash no Deno.connect)
      const smtpPort = Number(settings.smtp_port) || (settings.smtp_ssl ? 465 : 587);
      const imapPort = Number(settings.imap_port) || (settings.imap_ssl ? 993 : 143);

      if (isNaN(smtpPort) || isNaN(imapPort)) {
        throw new Error("Portas SMTP ou IMAP inválidas.");
      }

      // BREVO & MULTI-PASS DETECT
      let imapPass = settings.pass;
      let smtpPass = settings.pass;

      if (settings.pass?.includes(':')) {
        const parts = settings.pass.split(':');
        imapPass = parts[0];
        smtpPass = parts[1];
        console.log("[V36] Senhas múltiplas detectadas");
      }

      const isBrevo = settings.smtp_host?.includes('brevo');
      const hasBrevoKey = settings.brevo_api_key || smtpPass?.startsWith('xkeysib-');
      const brevoKey = settings.brevo_api_key || (hasBrevoKey ? smtpPass : null);

      let smtpResult: any;
      let imapResult: any;

      // 1. TESTE SMTP / BREVO
      if (isBrevo && brevoKey) {
        console.log(`[V36] Testando via Brevo API...`);
        const auth = await testBrevoAuth(brevoKey);
        if (auth.ok) {
          smtpResult = { status: 'fulfilled', value: "Brevo API OK" };
        } else {
          smtpResult = { status: 'rejected', reason: new Error(`Brevo: ${auth.error}`) };
        }
      } else {
        // Teste SMTP tradicional
        const smtpHostOk = await verifyHost(settings.smtp_host);
        if (!smtpHostOk.ok) throw new Error(`DNS SMTP: ${smtpHostOk.error}`);

        const useSmtpSsl = settings.smtp_ssl ?? (smtpPort === 465);
        const probe = useSmtpSsl ? await probeTls(settings.smtp_host, smtpPort) : await testConnection(settings.smtp_host, smtpPort);

        if (!probe.ok) {
          smtpResult = { status: 'rejected', reason: new Error(`SMTP Socket: ${probe.error}`) };
        } else {
          const transporter = nodemailer.createTransport({
            host: settings.smtp_host,
            port: smtpPort,
            secure: useSmtpSsl,
            auth: { user: settings.user, pass: smtpPass },
            tls: { rejectUnauthorized: false, minVersion: 'TLSv1.2' },
            connectionTimeout: 10000,
          });
          try {
            await transporter.verify();
            smtpResult = { status: 'fulfilled', value: "SMTP OK" };
          } catch (e: any) {
            smtpResult = { status: 'rejected', reason: e };
          }
        }
      }

      // 2. TESTE IMAP
      const imapHostOk = await verifyHost(settings.imap_host);
      if (!imapHostOk.ok) throw new Error(`DNS IMAP: ${imapHostOk.error}`);

      const useImapSsl = settings.imap_ssl ?? (imapPort === 993);
      const imapProbe = useImapSsl ? await probeTls(settings.imap_host, imapPort) : await testConnection(settings.imap_host, imapPort);

      if (!imapProbe.ok) {
        imapResult = { status: 'rejected', reason: new Error(`IMAP Socket: ${imapProbe.error}`) };
      } else {
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
          await client.logout();
          imapResult = { status: 'fulfilled', value: "IMAP OK" };
        } catch (e: any) {
          imapResult = { status: 'rejected', reason: e };
        }
      }

      const duration = Number(((Date.now() - start) / 1000).toFixed(1));

      if (smtpResult.status === 'fulfilled' && imapResult.status === 'fulfilled') {
        const msg = isBrevo ? `Sucesso! Brevo API e IMAP OK (${duration}s).` : `Sucesso! SMTP e IMAP OK (${duration}s).`;
        return new Response(JSON.stringify({ success: true, message: msg }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let errorMsg = "";
      if (smtpResult.status === 'rejected') errorMsg += `SMTP/Brevo: ${smtpResult.reason.message}. `;
      if (imapResult.status === 'rejected') errorMsg += `IMAP: ${imapResult.reason.message}. `;

      if (isBrevo && imapResult.status === 'rejected' && imapResult.reason?.message?.includes('Unexpected close')) {
        errorMsg += " Dica: Hostinger bloqueou o IMAP. Tente porta 143 sem SSL.";
      }

      return new Response(JSON.stringify({
        success: false,
        error: errorMsg.trim(),
        debug: { smtp: smtpResult, imap: imapResult, isBrevo },
        duration
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, message: 'V36 Online' }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error: any) {
    console.error(`[V36 ERROR]`, error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
