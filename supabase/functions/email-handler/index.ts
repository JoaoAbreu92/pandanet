const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper para testar se uma porta TCP está aberta
async function testConnection(host: string, port: number, timeout = 5000) {
  try {
    const conn = await Deno.connect({ hostname: host, port });
    conn.close();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// Helper para testar handshake TLS nativo do Deno
async function testTlsHandshake(host: string, port: number) {
  try {
    const conn = await Deno.connectTls({
      hostname: host, 
      port,
    });
    conn.close();
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

console.log("Edge Function 'email-handler' V23 (CORS Fix & Deep Diag) iniciada.");

Deno.serve(async (req) => {
  // 1. CORS Preflight - SEMPRE NO TOPO ABSOLUTO
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 2. Health Check
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Edge Function Online (V23). CORS Fixed.' 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  try {
    if (req.method !== 'POST') throw new Error(`Método ${req.method} não suportado.`);

    const payload = await req.json().catch(() => ({}));
    const { action, settings } = payload;

    if (!action) throw new Error("Ação não informada.");

    console.log(`[V23] Ação: ${action}`);

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
            rejectUnauthorized: true, // Começar restrito na V23
            servername: settings.smtp_host
          },
          requireTLS: !isPort465, 
          connectionTimeout: 15000,
          greetingTimeout: 15000
        })
        await transporter.verify();
      } catch (e: any) {
        // Se falhar, tentar bypass agressivo
        console.log("[V23] SMTP falhou, tentando fallback com ignore TLS...");
        const transporter = nodemailer.default.createTransport({
          host: settings.smtp_host,
          port: settings.smtp_port,
          secure: Number(settings.smtp_port) === 465,
          auth: { user: settings.user, pass: settings.pass },
          tls: {
            rejectUnauthorized: false, // Bypass aqui se o normal falhar
            servername: settings.smtp_host
          }
        });
        await transporter.verify().catch(err => {
          throw new Error(`SMTP Falhou: ${err.message}`);
        });
      }

      // --- TESTE IMAP ---
      try {
        const isPort993 = Number(settings.imap_port) === 993;

        // Diagnóstico Nativo
        if (isPort993) {
          const nativeTls = await testTlsHandshake(settings.imap_host, settings.imap_port);
          if (!nativeTls.ok) console.error("[V23] Handshake Nativo Falhou:", nativeTls.error);
        }

        const client = new ImapFlow({
          host: settings.imap_host,
          port: settings.imap_port,
          secure: isPort993,
          auth: { user: settings.user, pass: settings.pass },
          logger: true,
          tls: { 
            rejectUnauthorized: false,
            servername: settings.imap_host,
            checkServerIdentity: () => undefined
          },
          connectionTimeout: 30000,
          greetingTimeout: 30000
        })
        await client.connect();
        await client.logout();
      } catch (e: any) {
        console.error("[IMAP V23 ERROR]", e);
        const openPorts = await scanCommonPorts(settings.imap_host);
        let msg = e.message;
        if (msg.includes('Unexpected close')) msg = "Conexão fechada durante handshake (TLS/SSL).";
        throw new Error(`IMAP Falhou: ${msg}. Portas abertas detectadas: ${openPorts.join(', ') || 'Nenhuma'}`);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Conectado com sucesso na V23!'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ success: true, message: 'Ação ok na V23.' }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error: any) {
    console.error(`[V23 ERROR]`, error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
