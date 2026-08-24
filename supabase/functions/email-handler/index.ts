const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper para testar se uma porta TCP está aberta
async function testConnection(host: string, port: number, timeout = 7000) {
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

console.log("Edge Function 'email-handler' V20 (TLS Core Bypass) iniciada.");

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method === 'GET') {
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Edge Function Online (V20). TLS 1.2 Force & IDE Lint active.' 
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

    console.log(`[V20] Executando ação: ${action}`);

    if (action === 'test-connection') {
      if (!settings) throw new Error("Configurações (settings) não fornecidas.");

      const nodemailer = await import("npm:nodemailer@6.9.7");
      const { ImapFlow } = await import("npm:imapflow@1.0.141");

      // --- DIAGNÓSTICO DE REDE ---
      const smtpReach = await testConnection(settings.smtp_host, Number(settings.smtp_port));
      const imapReach = await testConnection(settings.imap_host, Number(settings.imap_port));

      if (!smtpReach.ok) {
        throw new Error(`SMTP (Inacessível): O servidor '${settings.smtp_host}' não responde na porta ${settings.smtp_port}. Verifique se o endereço está correto ou tente mail.${settings.smtp_host}.`);
      }
      if (!imapReach.ok) {
        throw new Error(`IMAP (Inacessível): O servidor '${settings.imap_host}' não responde na porta ${settings.imap_port}. O erro 'os error 110' na Acrilight indica que este endereço (${settings.imap_host}) não possui serviço IMAP ativo ou o endereço está errado.`);
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
          connectionTimeout: 20000,
          greetingTimeout: 20000
        })
        await transporter.verify();
        console.log("[SMTP V20] OK");
      } catch (e: any) {
        throw new Error(`SMTP (Erro Protocolo): ${e.message}`);
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
            checkServerIdentity: () => undefined,
            // Força TLS 1.2 no Deno para evitar problemas de handshake 1.3
            minVersion: 'TLSv1.2',
            maxVersion: 'TLSv1.2'
          },
          connectionTimeout: 40000,
          greetingTimeout: 40000
        })
        await client.connect();
        await client.logout();
        console.log("[IMAP V20] OK");
      } catch (e: any) {
        console.error("[IMAP ERROR V20]", e);
        let errorMsg = e.message;
        if (errorMsg.includes('Unexpected close')) {
          errorMsg = `Conexão fechada durante o handshake. Dica para Hostinger: Certifique-se de usar imap.hostinger.com na porta 993 com SSL.`;
        }
        throw new Error(`IMAP: ${errorMsg}`);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Conexão validada com sucesso na V20!'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Ação '${action}' ok na V20.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
