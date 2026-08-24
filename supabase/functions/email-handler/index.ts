const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Edge Function 'email-handler' V14 (Power TLS Bypass) iniciada.");

// Tentativa de forçar o bypass no nível do processo Deno/Node emulation
try {
  Deno.env.set('NODE_TLS_REJECT_UNAUTHORIZED', '0');
  console.log("NODE_TLS_REJECT_UNAUTHORIZED definido como '0'.");
} catch (e) {
  console.warn("Não foi possível definir NODE_TLS_REJECT_UNAUTHORIZED via código:", e.message);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method === 'GET') {
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Edge Function email-handler Online (V14). TLS Power Bypass Active.' 
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

    console.log(`[V14] Executando ação: ${action}`);

    if (action === 'test-connection') {
      if (!settings) throw new Error("Configurações (settings) não fornecidas.");

      const nodemailer = await import("npm:nodemailer@6.9.7");
      const { ImapFlow } = await import("npm:imapflow@1.0.141");

      // Teste SMTP com Bypass Agressivo
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
          debug: true,
          logger: true,
          tls: { 
            rejectUnauthorized: false,
            servername: settings.smtp_host,
            checkServerIdentity: (hostname, cert) => {
              console.log(`[TLS] Ignorando verificação de identidade para: ${hostname}`);
              return undefined;
            }
          },
          requireTLS: settings.smtp_port === 465
        })

        await transporter.verify();
        console.log("[SMTP] Sucesso na verificação.");
      } catch (e: any) {
        console.error("[SMTP ERROR]", e);
        let msg = e.message;
        if (msg.includes('NotValidForName')) {
          msg += " (Dica: O Deno é rígido com certificados. Tente usar o endereço IP do servidor SMTP se o hostname falhar).";
        }
        throw new Error(`Erro no Servidor de Envio (SMTP): ${msg}`);
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
          logger: true,
          tls: { 
            rejectUnauthorized: false,
            servername: settings.imap_host,
            checkServerIdentity: () => undefined
          }
        })
        await client.connect();
        await client.logout();
        console.log("[IMAP] Sucesso na conexão.");
      } catch (e: any) {
        console.error("[IMAP ERROR]", e);
        throw new Error(`Erro no Servidor de Recebimento (IMAP): ${e.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Conexão estabelecida com sucesso na V14 (Bypass Ativo)!'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Ação '${action}' na V14.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error(`[RUNTIME ERROR V14]`, error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
