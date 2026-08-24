const express = require('express');
const cors = require('cors');
const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '/root/supabase/supabase/docker/.env' });

const app = express();
const PORT = 3001;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET not found. Make sure /root/supabase/supabase/docker/.env is accessible.');
    process.exit(1);
}

app.use(cors());
app.use(express.json());

// --- JWT Auth Middleware ---
function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    const token = authHeader.split(' ')[1];
    try {
        jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// --- Helper ---
const ensureNumber = (val) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
};

// --- FETCH EMAILS (IMAP) ---
app.post('/api/email/fetch', authMiddleware, async (req, res) => {
    const { config } = req.body;
    if (!config || !config.imap_host) {
        return res.status(400).json({ error: 'Missing IMAP config' });
    }

    console.log(`[email-server] FETCH: ${config.imap_host}:${config.imap_port} (user: ${config.imap_user})`);

    const client = new ImapFlow({
        host: config.imap_host,
        port: ensureNumber(config.imap_port),
        secure: config.imap_ssl !== false,
        auth: {
            user: config.imap_user,
            pass: config.imap_pass,
        },
        tls: { rejectUnauthorized: false },
        logger: false
    });

    try {
        await client.connect();
        const lock = await client.getMailboxLock('INBOX');
        const emails = [];

        try {
            const status = client.mailbox;
            console.log(`[email-server] Mailbox: ${status?.exists} messages`);

            if (!status || status.exists === 0) {
                return res.json([]);
            }

            const total = status.exists;
            const fetchStart = Math.max(1, total - 19);
            const range = `${fetchStart}:*`;

            for await (const message of client.fetch(range, { envelope: true, source: false }, { uid: true })) {
                emails.push({
                    uid: message.uid,
                    messageId: message.envelope.messageId || `uid-${message.uid}`,
                    subject: message.envelope.subject || '(Sem Assunto)',
                    from: message.envelope.from?.[0]?.address || 'Desconhecido',
                    date: message.envelope.date,
                    flags: message.flags
                });
            }

            emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return res.json(emails);

        } finally {
            lock.release();
            await client.logout();
        }
    } catch (err) {
        console.error('[email-server] IMAP Error:', err.message, err.code);
        return res.status(500).json({ error: `IMAP Error: ${err.message || err.code || 'Unknown'}` });
    }
});

// --- SEND EMAIL (SMTP) ---
app.post('/api/email/send', authMiddleware, async (req, res) => {
    const { config, payload } = req.body;
    if (!config || !payload) {
        return res.status(400).json({ error: 'Missing config or payload' });
    }

    console.log(`[email-server] SEND: ${config.smtp_host}:${config.smtp_port} -> ${payload.to}`);

    const transporter = nodemailer.createTransport({
        host: config.smtp_host,
        port: ensureNumber(config.smtp_port),
        secure: config.smtp_ssl !== false,
        auth: { user: config.smtp_user, pass: config.smtp_pass },
        tls: { rejectUnauthorized: false }
    });

    try {
        await transporter.sendMail({
            from: config.smtp_user,
            to: payload.to,
            subject: payload.subject,
            text: payload.text,
            html: payload.html
        });
        return res.json({ success: true });
    } catch (err) {
        console.error('[email-server] SMTP Error:', err.message);
        return res.status(500).json({ error: `SMTP Error: ${err.message}` });
    }
});

// --- TEST CONNECTION ---
app.post('/api/email/test', authMiddleware, async (req, res) => {
    const { config } = req.body;
    const results = { imap: false, smtp: false };

    // Test IMAP
    const imapClient = new ImapFlow({
        host: config.imap_host,
        port: ensureNumber(config.imap_port),
        secure: config.imap_ssl !== false,
        auth: { user: config.imap_user, pass: config.imap_pass },
        tls: { rejectUnauthorized: false },
        logger: false
    });
    try {
        await imapClient.connect();
        await imapClient.logout();
        results.imap = true;
    } catch (err) {
        console.error('[email-server] IMAP test failed:', err.message);
    }

    // Test SMTP
    const transporter = nodemailer.createTransport({
        host: config.smtp_host,
        port: ensureNumber(config.smtp_port),
        secure: config.smtp_ssl !== false,
        auth: { user: config.smtp_user, pass: config.smtp_pass },
        tls: { rejectUnauthorized: false }
    });
    try {
        await transporter.verify();
        results.smtp = true;
    } catch (err) {
        console.error('[email-server] SMTP test failed:', err.message);
    }

    return res.json(results);
});

// --- Health check ---
app.get('/api/email/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
    console.log(`[email-server] Running on port ${PORT}`);
});
