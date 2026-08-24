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

        // 1. TEST CONNECTION (IMAP & SMTP)
        if (action === 'test') {
            const results = { imap: false, smtp: false, error: null };
            
            // Test SMTP
            try {
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
                    port: config.imap_port,
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
                port: config.imap_port,
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
            const lock = await client.getMailboxLock('INBOX');
            const emails = [];

            try {
                // Fetch last 20 emails
                for await (const message of client.fetch('1:*', { envelope: true, source: false }, { uid: true })) {
                    emails.push({
                        uid: message.uid,
                        subject: message.envelope.subject,
                        from: message.envelope.from[0]?.address,
                        date: message.envelope.date,
                        flags: message.flags
                    });
                }
                // Sort by newest
                emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const recentEmails = emails.slice(0, 30); // Return last 30

                return new Response(JSON.stringify(recentEmails), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            } finally {
                lock.release();
                await client.logout();
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

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}, { port: 9999 });
