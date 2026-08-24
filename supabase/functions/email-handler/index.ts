import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nodemailer from "npm:nodemailer@6.9.7";
import { ImapFlow } from "npm:imapflow@1.0.141";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper para verificar se o host existe (DNS)
async function verifyHost(host: string) {
  try {
    const ips = await Deno.resolveDns(host, "A");
    return { ok: true, ips };
  } catch (e: any) {
    // Tentar resolver como IPv4 se for endereço direto ou outro erro
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

// Escaneia portas comuns em caso de falha TOTAL
async function scanCommonPorts(host: string) {
  const ports = [993, 465, 587, 143, 25];
  const results = [];
  for (const port of ports) {
    const res = await testConnection(host, port, 1500); // Timeout agressivo para scan
    if (res.ok) results.push(port);
  }
  return results;
}

console.log("Edge Function 'email-handler' V28 (Hostinger & Global Timeout) iniciada.");

Deno.serve(async (req) => {
  // 1. CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 2. Health Check
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Edge Function Online (V24). Explicit SSL Control.' 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  try {
    if (req.method !== 'POST') throw new Error(`Método ${req.method} não suportado.`);

    const payload = await req.json().catch(() => ({}));
    const { action, settings } = payload;

    if (!action) throw new Error("Ação não informada.");

    console.log(`[V28] Ação: ${action}`);

    if (action === 'test-connection') {
      if (!settings) throw new Error("Configurações ausentes.");
      const start = Date.now();

      // 1. VERIFICAR DNS (SMTP e IMAP podem ser diferentes)
      const smtpHostOk = await verifyHost(settings.smtp_host);
      if (!smtpHostOk.ok) throw new Error(`DNS SMTP: ${smtpHostOk.error} (${settings.smtp_host})`);

      const imapHostOk = await verifyHost(settings.imap_host);
      if (!imapHostOk.ok) throw new Error(`DNS IMAP: ${imapHostOk.error} (${settings.imap_host})`);

      // Determinar flags de SSL
      const useSmtpSsl = settings.smtp_ssl ?? (settings.smtp_port === 465);
      const useImapSsl = settings.imap_ssl ?? (settings.imap_port === 993);

      console.log(`[V28] Testando: SMTP(${settings.smtp_host}:${settings.smtp_port}, SSL:${useSmtpSsl}) | IMAP(${settings.imap_host}:${settings.imap_port}, SSL:${useImapSsl})`);

      // 2. RODAR TESTES COM TIMEOUT GLOBAL (Segurança extra contra hangs)
      const globalTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout Global (35s) atingido - servidor não respondeu a tempo.")), 35000)
      );

      const resultsPromise = Promise.allSettled([
        // Teste SMTP
        (async () => {
          const transporter = nodemailer.createTransport({
            host: settings.smtp_host,
            port: settings.smtp_port,
            secure: useSmtpSsl,
            auth: { user: settings.user, pass: settings.pass },
            tls: { 
              rejectUnauthorized: false, 
              minVersion: 'TLSv1.2', // Aumentado para v1.2 por segurança/Hostinger
              checkServerIdentity: () => undefined 
            },
            connectionTimeout: 15000,
            greetingTimeout: 15000
          });
          await transporter.verify();
          return "SMTP OK";
        })(),
        // Teste IMAP
        (async () => {
          const client = new ImapFlow({
            host: settings.imap_host,
            port: settings.imap_port,
            secure: useImapSsl,
            auth: { user: settings.user, pass: settings.pass },
            logger: false,
            tls: { 
              rejectUnauthorized: false, 
              // Removido servername fixo para deixar o ImapFlow decidir ou usar o host
              checkServerIdentity: () => undefined,
              minVersion: 'TLSv1.2' // Aumentado para v1.2
            },
            connectionTimeout: 25000,
            greetingTimeout: 25000
          });
          await client.connect();
          await client.logout();
          return "IMAP OK";
        })()
      ]);

      // Corrida contra o timeout global
      const results: any = await Promise.race([resultsPromise, globalTimeoutPromise]);

      const [smtpRes, imapRes] = results;
      const duration = Number(((Date.now() - start) / 1000).toFixed(1));

      // 3. ANALISAR RESULTADOS
      if (smtpRes.status === 'fulfilled' && imapRes.status === 'fulfilled') {
        return new Response(JSON.stringify({
          success: true,
          message: `Conectado com sucesso em ${duration}s! (SMTP e IMAP OK)`
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 4. DIAGNÓSTICO EM CASO DE FALHA
      let errorMsg = "";
      let debugInfo: any = {};

      if (smtpRes.status === 'rejected') {
        const err = smtpRes.reason;
        console.error("[V28 SMTP ERROR]", err);
        let rs = err.message || "Erro SMTP desconhecido.";
        debugInfo.smtp = { code: err.code, name: err.name, stack: err.stack?.substring(0, 150) };
        if (rs.includes("invalid peer certificate")) rs = "Certificado SMTP inválido ou incompatível.";
        errorMsg += `SMTP: ${rs}. `;
      }

      if (imapRes.status === 'rejected') {
        const err = imapRes.reason;
        console.error("[V28 IMAP ERROR]", err);
        let imapMsg = err.message || "Erro IMAP desconhecido.";
        debugInfo.imap = { code: err.code, name: err.name, stack: err.stack?.substring(0, 150) };
        if (imapMsg.includes('Unexpected close')) imapMsg = "Conexão IMAP fechada pelo servidor (verifique porta/SSL/Timeouts).";
        if (imapMsg.includes('ENOTFOUND')) imapMsg = "Host IMAP não encontrado.";
        if (imapMsg.includes('ETIMEDOUT')) imapMsg = "Tempo de conexão IMAP esgotado.";
        errorMsg += `IMAP: ${imapMsg}. `;
      }

      // Scan opcional (Somente se não gastamos muito tempo)
      let openPorts: number[] = [];
      if (duration < 20 && smtpRes.status === 'rejected' && imapRes.status === 'rejected') {
        openPorts = await scanCommonPorts(settings.imap_host);
      }

      return new Response(JSON.stringify({
        success: false,
        error: errorMsg.trim(),
        debug: debugInfo,
        duration: duration,
        ports: openPorts.length ? openPorts : undefined
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Função Online V28.' }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error: any) {
    console.error(`[V24 ERROR]`, error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
