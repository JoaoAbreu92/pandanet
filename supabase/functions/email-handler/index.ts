const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Edge Function 'email-handler' V13 (Deep Debug) iniciada.");

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method === 'GET') {
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Edge Function email-handler Online (V13). Debug Mode Active.'
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

    console.log(`[V13] Executando ação: ${action}`);

    if (action === 'test-connection') {
      if (!settings) throw new Error("Configurações (settings) não fornecidas.");

      const nodemailer = await import("npm:nodemailer@6.9.7");
      const { ImapFlow } = await import("npm:imapflow@1.0.141");

      // Teste SMTP com Debug Ativo
      try {
        console.log(`[SMTP] Iniciando transporte para ${settings.smtp_host}:${settings.smtp_port}`);
        const transporter = nodemailer.default.createTransport({
          host: settings.smtp_host,
          port: settings.smtp_port,
          secure: settings.smtp_port === 465,
          auth: {
            user: settings.user,
            pass: settings.pass,
          },
          debug: true, // Habilita logs detalhados do protocolo
          logger: true, // Exibe o log no console
          tls: { 
            rejectUnauthorized: false,
            minVersion: 'TLSv1', // Permite versões mais antigas para compatibilidade
            checkServerIdentity: () => null // Retorna null em vez de undefined (alguns ambientes preferem assim)
          },
          // Garante que o Nodemailer não tente STARTTLS se a porta for 465 fixa
          requireTLS: settings.smtp_port === 465
        })

        await transporter.verify();
        console.log("[SMTP] Verificação concluída com sucesso.");
      } catch (e: any) {
        console.error("[SMTP ERROR]", e);
        throw new Error(`Erro no Servidor de Envio (SMTP): ${e.message}`);
      }

      // Teste IMAP com Bypass Agressivo
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
          logger: true, // Ativa logs do IMAPFlow
          tls: { 
            rejectUnauthorized: false,
            minVersion: 'TLSv1',
            checkServerIdentity: () => null
          }
        })
        await client.connect();
        await client.logout();
        console.log("[IMAP] Conexão concluída com sucesso.");
      } catch (e: any) {
        console.error("[IMAP ERROR]", e);
        throw new Error(`Erro no Servidor de Recebimento (IMAP): ${e.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Conexão SMTP e IMAP estabelecida com sucesso na V13!'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Ação '${action}' reconhecida na V13.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error(`[RUNTIME ERROR V13]`, error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: error.stack // Ajuda a depurar onde exatamente no código Deno falhou
    }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
