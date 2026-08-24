const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Edge Function 'email-handler' V16 (Explicit SNI) iniciada.");

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method === 'GET') {
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Edge Function Online (V16). Explicit SNI support active.' 
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

    console.log(`[V16] Executando ação: ${action}`);

    if (action === 'test-connection') {
      if (!settings) throw new Error("Configurações (settings) não fornecidas.");

      const nodemailer = await import("npm:nodemailer@6.9.7");
      const { ImapFlow } = await import("npm:imapflow@1.0.141");

      // Teste SMTP - Versão 16 com SNI Explícito
      try {
        console.log(`[SMTP] Conectando a ${settings.smtp_host}:${settings.smtp_port}`);
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
            // Explicitamente define o servername como o host original
            // Isso costuma resolver o NotValidForName no Deno
            servername: settings.smtp_host,
            checkServerIdentity: () => {
              console.log("[TLS] Bypassing Server Identity (V16)");
              return undefined;
            }
          },
          connectionTimeout: 10000,
          greetingTimeout: 10000
        })
        await transporter.verify();
        console.log("[SMTP] OK na V16");
      } catch (e: any) {
        console.error("[SMTP ERROR V16]", e);
        let errorMsg = e.message;
        if (errorMsg.includes('NotValidForName')) {
          errorMsg = `Erro de Certificado (NotValidForName): O servidor SMTP responde com um nome que não bate com o host. No Deno, isso é fatal na porta 465. Sugestão: Tente usar a porta 587 (STARTTLS) se disponível, ou verifique se o Hostname está correto.`;
        }
        throw new Error(`Erro no Servidor de Envio (SMTP): ${errorMsg}`);
      }

      // Teste IMAP - Versão 16
      try {
        console.log(`[IMAP] Conectando a ${settings.imap_host}:${settings.imap_port}`);
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
        console.log("[IMAP] OK na V16");
      } catch (e: any) {
        console.error("[IMAP ERROR V16]", e);
        throw new Error(`Erro no Servidor de Recebimento (IMAP): ${e.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Conexão estabelecida com sucesso na V16 (SNI Explícito)!'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Ação '${action}' na V16.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error(`[RUNTIME ERROR V16]`, error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
