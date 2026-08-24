const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Edge Function 'email-handler' V17 (STARTTLS & Cert Capture) iniciada.");

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method === 'GET') {
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Edge Function Online (V17). STARTTLS & Cert Capture active.' 
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

    console.log(`[V17] Executando ação: ${action}`);

    if (action === 'test-connection') {
      if (!settings) throw new Error("Configurações (settings) não fornecidas.");

      const nodemailer = await import("npm:nodemailer@6.9.7");
      const { ImapFlow } = await import("npm:imapflow@1.0.141");

      // Teste SMTP - Versão 17 com foco em 587/STARTTLS
      try {
        const isPort465 = Number(settings.smtp_port) === 465;
        console.log(`[SMTP V17] Conectando a ${settings.smtp_host}:${settings.smtp_port} (Secure: ${isPort465})`);

        const transporter = nodemailer.default.createTransport({
          host: settings.smtp_host,
          port: settings.smtp_port,
          secure: isPort465, // true para 465, false para 587
          auth: {
            user: settings.user,
            pass: settings.pass,
          },
          tls: { 
            rejectUnauthorized: false,
            servername: settings.smtp_host,
            minVersion: 'TLSv1',
            checkServerIdentity: (hostname, cert) => {
              console.log(`[TLS V17] Verificando: ${hostname}. Cert contém:`, cert.subject);
              return undefined; // Bypass total
            }
          },
          requireTLS: !isPort465,
          connectionTimeout: 15000,
          debug: true,
          logger: true
        })

        await transporter.verify();
        console.log("[SMTP] OK na V17");
      } catch (e: any) {
        console.error("[SMTP ERROR V17]", e);
        let errorMsg = e.message;
        if (errorMsg.includes('NotValidForName')) {
          const port = settings.smtp_port;
          errorMsg = `Erro de Certificado (NotValidForName) na porta ${port}: O servidor responde com um nome diferente do configurado. `;
          if (Number(port) === 465) {
            errorMsg += "Sugestão: Tente a porta 587.";
          } else {
            errorMsg += "Sugestão: Verifique se o Hostname está 100% correto ou tente usar o IP direto do servidor.";
          }
        }
        throw new Error(`Erro no SMTP: ${errorMsg}`);
      }

      // Teste IMAP - Versão 17
      try {
        console.log(`[IMAP V17] Conectando a ${settings.imap_host}:${settings.imap_port}`);
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
            rejectUnauthorized: false,
            servername: settings.imap_host,
            checkServerIdentity: () => undefined
          }
        })
        await client.connect();
        await client.logout();
        console.log("[IMAP] OK na V17");
      } catch (e: any) {
        console.error("[IMAP ERROR V17]", e);
        throw new Error(`Erro no IMAP: ${e.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Conexão estabelecida com sucesso na V17!'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Ação '${action}' na V17.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error(`[RUNTIME ERROR V17]`, error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
