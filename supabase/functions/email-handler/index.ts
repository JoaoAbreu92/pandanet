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

console.log("Edge Function 'email-handler' V29 (Native Probe & Fallback) iniciada.");

Deno.serve(async (req) => {
  // 1. CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 2. Health Check
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Edge Function Online (V29). Native Diagnostics.' 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  try {
    if (req.method !== 'POST') throw new Error(`Método ${req.method} não suportado.`);

    const payload = await req.json().catch(() => ({}));
    const { action, settings } = payload;

    if (!action) throw new Error("Ação não informada.");

    console.log(`[V29] Ação: ${action}`);

    if (action === 'test-connection') {
      if (!settings) throw new Error("Configurações ausentes.");
      const start = Date.now();

      // 1. VERIFICAR DNS
      const [smtpHostOk, imapHostOk] = await Promise.all([
        verifyHost(settings.smtp_host),
        verifyHost(settings.imap_host)
      ]);

      if (!smtpHostOk.ok) throw new Error(`DNS SMTP: ${smtpHostOk.error} (${settings.smtp_host})`);
      if (!imapHostOk.ok) throw new Error(`DNS IMAP: ${imapHostOk.error} (${settings.imap_host})`);

      // Determinar flags
      const useSmtpSsl = settings.smtp_ssl ?? (settings.smtp_port === 465);
      const useImapSsl = settings.imap_ssl ?? (settings.imap_port === 993);

      console.log(`[V29] Testando: SMTP(${settings.smtp_host}:${settings.smtp_port}) | IMAP(${settings.imap_host}:${settings.imap_port})`);

      // 2. PRE-FLIGHT (Teste nativo antes de carregar drivers pesados)
      const probes = await Promise.allSettled([
        useSmtpSsl ? probeTls(settings.smtp_host, settings.smtp_port) : testConnection(settings.smtp_host, settings.smtp_port),
        useImapSsl ? probeTls(settings.imap_host, settings.imap_port) : testConnection(settings.imap_host, settings.imap_port)
      ]);

      const [smtpProbe, imapProbe] = probes;
      let probeError = "";
      if (smtpProbe.status === 'fulfilled' && !smtpProbe.value.ok) probeError += `SMTP Socket: ${smtpProbe.value.error}. `;
      if (imapProbe.status === 'fulfilled' && !imapProbe.value.ok) probeError += `IMAP Socket: ${imapProbe.value.error}. `;

      if (probeError) {
        return new Response(JSON.stringify({
          success: false,
          error: `Falha de rede/firewall: ${probeError}`,
          debug: { smtpProbe, imapProbe },
          duration: ((Date.now() - start) / 1000).toFixed(1)
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 3. SE O SOCKET ESTÁ OK, TESTAR AUTENTICAÇÃO
      const resultsPromise = Promise.allSettled([
        // Teste SMTP
        (async () => {
          const transporter = nodemailer.createTransport({
            host: settings.smtp_host,
            port: settings.smtp_port,
            secure: useSmtpSsl,
            auth: { user: settings.user, pass: settings.pass },
            tls: { rejectUnauthorized: false, minVersion: 'TLSv1.2' },
            connectionTimeout: 10000,
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
            tls: { rejectUnauthorized: false, servername: settings.imap_host, minVersion: 'TLSv1.2' },
            connectionTimeout: 15000,
          });
          await client.connect();
          await client.logout();
          return "IMAP OK";
        })()
      ]);

      const globalTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout Global (45s)")), 45000));
      const results: any = await Promise.race([resultsPromise, globalTimeout]);

      const [smtpRes, imapRes] = results;
      const duration = Number(((Date.now() - start) / 1000).toFixed(1));

      if (smtpRes.status === 'fulfilled' && imapRes.status === 'fulfilled') {
        return new Response(JSON.stringify({
          success: true,
          message: `Sucesso! Conectado em ${duration}s.`
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 4. ERRO DE AUTENTICAÇÃO/DRIVER
      let errorMsg = "";
      if (smtpRes.status === 'rejected') errorMsg += `SMTP: ${smtpRes.reason.message}. `;
      if (imapRes.status === 'rejected') errorMsg += `IMAP: ${imapRes.reason.message}. `;

      return new Response(JSON.stringify({
        success: false,
        error: errorMsg.trim(),
        debug: { smtp: smtpRes, imap: imapRes },
        duration
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, message: 'V29 Online' }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error: any) {
    console.error(`[V29 ERROR]`, error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
