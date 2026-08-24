const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Edge Function 'email-handler' V11 (Robust) iniciada.");

Deno.serve(async (req) => {
  // 1. Lidar com preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 2. Lidar com GET (Health Check / Teste de Navegador)
  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      success: true,
      message: 'Edge Function email-handler está online (V11). Use POST para ações reais.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    // 3. Validar se é POST e tem corpo
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

      // Imports dinâmicos para evitar problemas de carregamento no topo
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
          tls: { rejectUnauthorized: false }
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
          tls: { rejectUnauthorized: false }
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

    // Outras ações (sync-emails, etc) podem ser adicionadas aqui
    return new Response(JSON.stringify({
      success: true,
      message: `Ação '${action}' recebida, mas não implementada nesta versão.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error("ERRO:", error.message);
    // Retornamos um status 200 com success:false para que o frontend 
    // receba a mensagem amigável em vez de um erro de rede 500.
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
