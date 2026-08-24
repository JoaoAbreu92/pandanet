const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper para testar se uma porta TCP está aberta
async function testConnection(host: string, port: number, timeout = 5000) {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const conn = await Deno.connect({ hostname: host, port });
    conn.close();
    clearTimeout(id);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

console.log("Edge Function 'email-handler' V19 (Network Diagnostics) iniciada.");

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method === 'GET') {
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Edge Function Online (V19). Network Diagnostics active.' 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  try {
    if (req.method !== 'POST') {
      throw new Error(`Método ${req.method} não suportado.`);
    }

    const payload = await req.json().catch(() => ({}));
    const { action, settings } = payload;

    if (!action) {
      throw new Error("Ação (action) não informada no corpo da requisição.");
    }

    console.log(`[V19] Executando ação: ${action}`);

    if (action === 'test-connection') {
      if (!settings) throw new Error("Configurações (settings) não fornecidas.");

      const nodemailer = await import("npm:nodemailer@6.9.7");
      const { ImapFlow } = await import("npm:imapflow@1.0.141");

      // --- DIAGNÓSTICO DE REDE ---
      console.log(`[V19] Iniciando pré-teste de rede...`);
      const smtpReach = await testConnection(settings.smtp_host, Number(settings.smtp_port));
      const imapReach = await testConnection(settings.imap_host, Number(settings.imap_port));

      console.log(`[V19] Rede SMTP (${settings.smtp_host}:${settings.smtp_port}):`, smtpReach.ok ? "ALCANÇÁVEL" : "FALHOU: " + smtpReach.error);
      console.log(`[V19] Rede IMAP (${settings.imap_host}:${settings.imap_port}):`, imapReach.ok ? "ALCANÇÁVEL" : "FALHOU: " + imapReach.error);

      if (!smtpReach.ok) {
        throw new Error(`SMTP: Servidor inacessível na porta ${settings.smtp_port}. Erro: ${smtpReach.error}`);
      }
      if (!imapReach.ok) {
        throw new Error(`IMAP: Servidor inacessível na porta ${settings.imap_port}. Erro: ${imapReach.error}`);
      }

      // --- TESTE SMTP ---
      try {
        const isPort465 = Number(settings.smtp_port) === 465;
        const transporter = nodemailer.default.createTransport({
          host: settings.smtp_host,
          port: settings.smtp_port,
          secure: isPort465,
          auth: {
            user: settings.user,
            pass: settings.pass,
          },
          tls: { 
            rejectUnauthorized: false,
            servername: settings.smtp_host,
            checkServerIdentity: () => undefined
          },
          requireTLS: !isPort465, 
          connectionTimeout: 20000, // Aumentado para 20s
          greetingTimeout: 20000,   // Aumentado para 20s
          debug: true,
          logger: true
        })

        await transporter.verify();
        console.log("[SMTP] OK na V19");
      } catch (e: any) {
        console.error("[SMTP ERROR V19]", e);
        throw new Error(`SMTP: ${e.message}`);
      }

      // --- TESTE IMAP ---
      try {
        const isPort993 = Number(settings.imap_port) === 993;
        const client = new ImapFlow({
          host: settings.imap_host,
          port: settings.imap_port,
          secure: isPort993,
          auth: {
            user: settings.user,
            pass: settings.pass,
          },
          logger: true,
          tls: { 
            rejectUnauthorized: false,
            servername: settings.imap_host,
            checkServerIdentity: () => undefined
          },
          clientContext: "PandaNet",
          connectionTimeout: 30000, // Aumentado para 30s
          greetingTimeout: 30000    // Aumentado para 30s
        })
        await client.connect();
        await client.logout();
        console.log("[IMAP] OK na V19");
      } catch (e: any) {
        console.error("[IMAP ERROR V19]", e);
        let errorMsg = e.message;
        if (errorMsg.includes('Unexpected close')) {
          errorMsg = `Conexão IMAP fechada inesperadamente. Verifique se a porta '${settings.imap_port}' é correta para o tipo de segurança usado.`;
        }
        throw new Error(`IMAP: ${errorMsg}`);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Conexão SMTP e IMAP validada com sucesso na V19!'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Ação '${action}' processada na V19.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error(`[V19 ERROR]`, error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
