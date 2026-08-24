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

// Escaneia portas comuns em caso de falha para dar diagnóstico ao usuário
async function scanCommonPorts(host: string) {
  const ports = [143, 993, 587, 465, 110, 995, 25];
  const results = [];
  for (const port of ports) {
    const res = await testConnection(host, port, 2000);
    if (res.ok) results.push(port);
  }
  return results;
}

console.log("Edge Function 'email-handler' V21 (Protocol Scout) iniciada.");

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method === 'GET') {
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Edge Function Online (V21). Protocol Scout active.' 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  try {
    if (req.method !== 'POST') throw new Error(`Método ${req.method} não suportado.`);

    const payload = await req.json().catch(() => ({}));
    const { action, settings } = payload;

    if (!action) throw new Error("Ação não informada.");

    console.log(`[V21] Ação: ${action}`);

    if (action === 'test-connection') {
      if (!settings) throw new Error("Configurações ausentes.");

      const nodemailer = await import("npm:nodemailer@6.9.7");
      const { ImapFlow } = await import("npm:imapflow@1.0.141");

      // --- TESTE SMTP ---
      try {
        const isPort465 = Number(settings.smtp_port) === 465;
        const transporter = nodemailer.default.createTransport({
          host: settings.smtp_host,
          port: settings.smtp_port,
          secure: isPort465,
          auth: { user: settings.user, pass: settings.pass },
          tls: { 
            rejectUnauthorized: false,
            servername: settings.smtp_host,
            minVersion: 'TLSv1', // Legacy support
            ciphers: 'DEFAULT@SECLEVEL=0' // Bypass total de restrições TLS
          },
          requireTLS: !isPort465, 
          connectionTimeout: 15000,
          greetingTimeout: 15000
        })
        await transporter.verify();
      } catch (e: any) {
        const openPorts = await scanCommonPorts(settings.smtp_host);
        throw new Error(`SMTP Falhou: ${e.message}. Portas abertas detectadas em '${settings.smtp_host}': ${openPorts.join(', ') || 'Nenhuma'}`);
      }

      // --- TESTE IMAP ---
      try {
        const isPort993 = Number(settings.imap_port) === 993;
        const client = new ImapFlow({
          host: settings.imap_host,
          port: settings.imap_port,
          secure: isPort993,
          auth: { user: settings.user, pass: settings.pass },
          logger: true,
          tls: { 
            rejectUnauthorized: false,
            servername: settings.imap_host,
            checkServerIdentity: () => undefined,
            minVersion: 'TLSv1', // Legacy support
            ciphers: 'DEFAULT@SECLEVEL=0' 
          },
          connectionTimeout: 30000,
          greetingTimeout: 30000
        })
        await client.connect();
        await client.logout();
      } catch (e: any) {
        console.error("[IMAP V21 ERROR]", e);
        const openPorts = await scanCommonPorts(settings.imap_host);
        let msg = e.message;
        if (msg.includes('Unexpected close')) msg = "Conexão fechada durante handshake (TLS/SSL).";
        throw new Error(`IMAP Falhou: ${msg}. Portas abertas detectadas em '${settings.imap_host}': ${openPorts.join(', ') || 'Nenhuma'}`);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Conectado com sucesso na V21!'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ success: true, message: 'Ação ok na V21.' }), {
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
