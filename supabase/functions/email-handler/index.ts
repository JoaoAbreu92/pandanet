const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Edge Function 'email-handler' V12 (TLS Bypass) iniciada.");

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      success: true, 
      message: 'Edge Function email-handler está online (V12). Suporte a TLS Bypass ativo.'
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

    console.log(`Executando ação: ${action}`);

    if (action === 'test-connection') {
      if (!settings) throw new Error("Configurações (settings) não fornecidas.");

      const nodemailer = await import("npm:nodemailer@6.9.7");
      const { ImapFlow } = await import("npm:imapflow@1.0.141");

      // Teste SMTP
      try {
        const transporter = nodemailer.default.createTransport({
          host: settings.smtp_host,
          port: settings.smtp_port,
          secure: settings.smtp_port === 465,
          auth: {
            user: settings.user,
            pass: settings.pass,
          },
          tls: {
            rejectUnauthorized: false,
            checkServerIdentity: () => undefined
          }
        })
        await transporter.verify();
        console.log("SMTP OK");
      } catch (e: any) {
        throw new Error(`Erro no Servidor de Envio (SMTP): ${e.message}`);
      }

      // Teste IMAP
      try {
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
            checkServerIdentity: () => undefined
          }
        })
        await client.connect();
        await client.logout();
        console.log("IMAP OK");
      } catch (e: any) {
        throw new Error(`Erro no Servidor de Recebimento (IMAP): ${e.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Conexão SMTP e IMAP estabelecida com sucesso!'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Ação '${action}' recebida, mas não implementada nesta versão.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error("ERRO:", error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
