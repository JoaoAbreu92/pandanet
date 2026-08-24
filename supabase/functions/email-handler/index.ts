import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ImapFlow } from "https://esm.sh/imapflow@1.0.124";
import nodemailer from "https://esm.sh/nodemailer@6.9.1";

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { action, config, payload } = await req.json();

        console.log(`[EmailHandler] Action: ${action}`);
        if (config) console.log(`[EmailHandler] Config Host: ${config.imap_host}:${config.imap_port} (User: ${config.imap_user})`);

        // Helper to ensure number
        const ensureNumber = (val: any) => {
            const num = Number(val);
            return isNaN(num) ? 0 : num;
        };

        // 1. TEST CONNECTION (IMAP & SMTP)
        if (action === 'test') {
            const results = { imap: false, smtp: false, error: null };
            
            // Test SMTP
            try {
                const transporter = nodemailer.createTransport({
                    host: config.smtp_host,
                    port: ensureNumber(config.smtp_port),
                    secure: config.smtp_ssl,
                    auth: {
                        user: config.smtp_user,
                        pass: config.smtp_pass,
                    },
                    tls: {
                        rejectUnauthorized: false
                    }
                });
                await transporter.verify();
                results.smtp = true;
            } catch (err) {
                console.error("SMTP Error:", err);
                throw new Error(`SMTP Falhou: ${err.message}`);
            }

            // Test IMAP
            try {
                const client = new ImapFlow({
                    host: config.imap_host,
                    port: ensureNumber(config.imap_port),
                    secure: config.imap_ssl,
                    auth: {
                        user: config.imap_user,
                        pass: config.imap_pass,
                    },
                    tls: {
                        rejectUnauthorized: false
                    },
                    logger: false
                });
                await client.connect();
                await client.logout();
                results.imap = true;
            } catch (err) {
                console.error("IMAP Error:", err);
                throw new Error(`IMAP Falhou: ${err.message}`);
            }

            return new Response(JSON.stringify(results), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // 2. FETCH EMAILS (IMAP)
        if (action === 'fetch') {
             const client = new ImapFlow({
                host: config.imap_host,
                 port: ensureNumber(config.imap_port),
                secure: config.imap_ssl,
                auth: {
                    user: config.imap_user,
                    pass: config.imap_pass,
                },
                tls: {
                    rejectUnauthorized: false
                },
                logger: false
            });


            // Helper: Connect with Timeout
            const connectWithTimeout = async (client: any, timeoutMs: number = 15000) => {
                let timer: any;
                const timeoutPromise = new Promise((_, reject) => {
                    timer = setTimeout(() => reject(new Error(`Connection timed out after ${timeoutMs}ms`)), timeoutMs);
                });

                try {
                    await Promise.race([
                        client.connect(),
                        timeoutPromise
                    ]);
                } finally {
                    clearTimeout(timer);
                }
            };

            try {
                console.log("[EmailHandler] Connecting to IMAP...");
                await connectWithTimeout(client);
                console.log("[EmailHandler] Connected.");

                // Acquire lock and select mailbox
                const lock = await client.getMailboxLock('INBOX');
                const emails = [];

                try {
                    // client.mailbox is populated after selection
                    const status = client.mailbox;
                    console.log(`[EmailHandler] Mailbox Status: ${status?.exists} messages`);

                    if (!status || status.exists === 0) {
                        return new Response(JSON.stringify([]), {
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        });
                    }

                    const total = status.exists;
                    const fetchStart = Math.max(1, total - 19);
                    const range = `${fetchStart}:*`;

                    for await (const message of client.fetch(range, { envelope: true, source: false }, { uid: true })) {
                        emails.push({
                            uid: message.uid,
                            messageId: message.envelope.messageId || `uid-${message.uid}`,
                            subject: message.envelope.subject || '(Sem Assunto)',
                            from: message.envelope.from && message.envelope.from[0] ? message.envelope.from[0]?.address : 'Desconhecido',
                            date: message.envelope.date,
                            flags: message.flags
                        });
                    }

                    // Sort by newest
                    emails.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    return new Response(JSON.stringify(emails), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });

                } finally {
                    if (lock) lock.release();
                    await client.logout();
                }

            } catch (err: any) {
                console.error("IMAP Connection/Fetch Error:", err);
                // Return 200 with error field so frontend handles it gracefully
                return new Response(JSON.stringify({ error: `IMAP Error: ${err.message}` }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
        }

        // 3. SEND EMAIL (SMTP)
        if (action === 'send') {
            const transporter = nodemailer.createTransport({
                host: config.smtp_host,
                port: config.smtp_port,
                secure: config.smtp_ssl,
                auth: {
                    user: config.smtp_user,
                    pass: config.smtp_pass,
                },
                tls: {
                    rejectUnauthorized: false
                }
            });

            await transporter.sendMail({
                from: config.smtp_user,
                to: payload.to,
                subject: payload.subject,
                text: payload.text,
                html: payload.html
            });

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ error: 'Invalid action' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error("Global Error:", error);
        return new Response(JSON.stringify({
            error: `Global Handler Error: ${error.message}`,
            stack: error.stack
        }), {
            status: 200, // Return 200 so frontend can read the error message
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}, { port: 9999 });
