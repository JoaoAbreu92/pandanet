const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Edge Function 'email-handler' V15 (IP & Blank SNI) iniciada.");

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method === 'GET') {
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Edge Function email-handler Online (V15). IP Resolution & SNI Bypass active.' 
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

    console.log(`[V15] Executando ação: ${action}`);

    if (action === 'test-connection') {
      if (!settings) throw new Error("Configurações (settings) não fornecidas.");

      const nodemailer = await import("npm:nodemailer@6.9.7");
      const { ImapFlow } = await import("npm:imapflow@1.0.141");

      // Tenta resolver o IP para contornar problemas de DNS/Hostname Mismatch no Deno
      let smtpIp = settings.smtp_host;
      let imapIp = settings.imap_host;

      try {
        const ipsSmtp = await Deno.resolveDns(settings.smtp_host, "A").catch(() => []);
        if (ipsSmtp.length > 0) {
          smtpIp = ipsSmtp[0];
          console.log(`[V15] SMTP: ${settings.smtp_host} -> ${smtpIp}`);
        }

        const ipsImap = await Deno.resolveDns(settings.imap_host, "A").catch(() => []);
        if (ipsImap.length > 0) {
          imapIp = ipsImap[0];
          console.log(`[V15] IMAP: ${settings.imap_host} -> ${imapIp}`);
        }
      } catch (dnsErr) {
        console.warn("[V15] Falha ao resolver DNS (usando hostnames originais):", dnsErr.message);
      }

      // Teste SMTP
      try {
        console.log(`[SMTP] Conectando a ${smtpIp}:${settings.smtp_port}`);
        const transporter = nodemailer.default.createTransport({
          host: smtpIp, // Usando IP se resolvido
          port: settings.smtp_port,
          secure: settings.smtp_port === 465,
          auth: {
            user: settings.user,
            pass: settings.pass,
          },
          tls: { 
            rejectUnauthorized: false,
            servername: "",
            checkServerIdentity: () => {
              console.log("[TLS] checkServerIdentity ignorado (V15)");
              return undefined;
            }
          }
        })
        await transporter.verify();
        console.log("[SMTP] OK");
      } catch (e: any) {
        console.error("[SMTP ERROR]", e);
        throw new Error(`Erro no Servidor de Envio (SMTP): ${e.message}`);
      }

      // Teste IMAP
      try {
        console.log(`[IMAP] Conectando a ${imapIp}:${settings.imap_port}`);
        const client = new ImapFlow({
          host: imapIp,
          port: settings.imap_port,
          secure: true,
          auth: {
            user: settings.user,
            pass: settings.pass,
          },
          logger: false,
          tls: { 
            rejectUnauthorized: false,
            servername: "",
            checkServerIdentity: () => undefined
          }
        })
        await client.connect();
        await client.logout();
        console.log("[IMAP] OK");
      } catch (e: any) {
        console.error("[IMAP ERROR]", e);
        throw new Error(`Erro no Servidor de Recebimento (IMAP): ${e.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Conexão estabelecida com sucesso na V15!'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Ação '${action}' recebida na V15.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error("[RUNTIME ERROR V15]", error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
