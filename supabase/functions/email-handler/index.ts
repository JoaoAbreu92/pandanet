const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Edge Function 'email-handler' V18 (Flexible IMAP) iniciada.");

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method === 'GET') {
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Edge Function Online (V18). Flexible IMAP & SMTP support active.' 
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

    console.log(`[V18] Executando ação: ${action}`);

    if (action === 'test-connection') {
      if (!settings) throw new Error("Configurações (settings) não fornecidas.");

      const nodemailer = await import("npm:nodemailer@6.9.7");
      const { ImapFlow } = await import("npm:imapflow@1.0.141");

      // --- TESTE SMTP ---
      try {
        const isPort465 = Number(settings.smtp_port) === 465;
        console.log(`[SMTP V18] Conectando a ${settings.smtp_host}:${settings.smtp_port} (Secure: ${isPort465})`);

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
          connectionTimeout: 15000,
          debug: true,
          logger: true
        })

        await transporter.verify();
        console.log("[SMTP] OK na V18");
      } catch (e: any) {
        console.error("[SMTP ERROR V18]", e);
        let errorMsg = e.message;
        if (errorMsg.includes('ENOTFOUND')) {
          errorMsg = `Servidor SMTP não encontrado: Verifique se o endereço '${settings.smtp_host}' está correto.`;
        } else if (errorMsg.includes('NotValidForName')) {
          errorMsg = `Erro de Certificado SMTP: O nome '${settings.smtp_host}' não bate com o certificado do servidor.`;
        }
        throw new Error(`SMTP: ${errorMsg}`);
      }

      // --- TESTE IMAP ---
      try {
        const isPort993 = Number(settings.imap_port) === 993;
        console.log(`[IMAP V18] Conectando a ${settings.imap_host}:${settings.imap_port} (Secure: ${isPort993})`);

        const client = new ImapFlow({
          host: settings.imap_host,
          port: settings.imap_port,
          secure: isPort993, // Só true se for 993
          auth: {
            user: settings.user,
            pass: settings.pass,
          },
          logger: true,
          tls: { 
            rejectUnauthorized: false,
            servername: settings.imap_host,
            checkServerIdentity: () => undefined
          }
        })
        await client.connect();
        await client.logout();
        console.log("[IMAP] OK na V18");
      } catch (e: any) {
        console.error("[IMAP ERROR V18]", e);
        let errorMsg = e.message;
        if (errorMsg.includes('ENOTFOUND')) {
          errorMsg = `Servidor IMAP não encontrado: Verifique se o endereço '${settings.imap_host}' está correto (ex: sem o 'imap.' inicial se o servidor for apenas o domínio).`;
        } else if (errorMsg.includes('Unexpected close')) {
          errorMsg = `Conexão IMAP fechada inesperadamente: Verifique se a porta '${settings.imap_port}' aceita a segurança configurada (tente 993 com SSL ou 143 com STARTTLS).`;
        }
        throw new Error(`IMAP: ${errorMsg}`);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'SMTP e IMAP conectados com sucesso na V18!'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Ação '${action}' ok na V18.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error(`[V18 ERROR]`, error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
