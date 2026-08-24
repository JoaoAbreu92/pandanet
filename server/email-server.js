const express = require('express');
const cors = require('cors');
const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '/root/pandanet/.env', override: true });
// Fallback: load Supabase env if JWT_SECRET not found yet
if (!process.env.JWT_SECRET) {
    require('dotenv').config({ path: '/root/supabase/supabase/docker/.env', override: true });
}

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

// --- IMAP Pool Management ---
const imapPool = new Map(); // key -> { client, lastUsed }
const POOL_IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

async function getPooledClient(config) {
    const key = `${config.imap_host}:${config.imap_user}`;
    const now = Date.now();

    if (imapPool.has(key)) {
        const entry = imapPool.get(key);
        if (entry.client.usable) {
            entry.lastUsed = now;
            console.log(`[email-server] Reusing pooled connection for ${config.imap_user}`);
            return entry.client;
        } else {
            console.log(`[email-server] Pooled connection for ${config.imap_user} stale, removing.`);
            try { await entry.client.logout(); } catch (e) { }
            imapPool.delete(key);
        }
    }

    console.log(`[email-server] Creating NEW connection for ${config.imap_user}`);
    const client = new ImapFlow({
        host: config.imap_host,
        port: ensureNumber(config.imap_port),
        secure: config.imap_ssl !== false,
        auth: { user: config.imap_user, pass: config.imap_pass },
        tls: { rejectUnauthorized: false },
        logger: false,
        connectionTimeout: 10000,
        greetingTimeout: 10000
    });

    try {
        await client.connect();
        imapPool.set(key, { client, lastUsed: now });
        return client;
    } catch (err) {
        if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
            throw new Error(`Servidor não encontrado: ${config.imap_host}. Verifique o endereço.`);
        }
        throw err;
    }
}

// Cleanup idle clients every minute
setInterval(async () => {
    const now = Date.now();
    for (const [key, entry] of imapPool.entries()) {
        if (now - entry.lastUsed > POOL_IDLE_TIMEOUT) {
            console.log(`[email-server] Closing idle connection for ${key}`);
            try { await entry.client.logout(); } catch (e) { }
            imapPool.delete(key);
        }
    }
}, 60000);

// --- FETCH EMAILS (IMAP) ---
app.post('/api/email/fetch', authMiddleware, async (req, res) => {
    const { config, path } = req.body;
    const mailboxPath = path || 'INBOX';
    if (!config || !config.imap_host) {
        return res.status(400).json({ error: 'Missing IMAP config' });
    }

    console.log(`[email-server] FETCH LIST: ${config.imap_host}:${config.imap_port}`);

    try {
        const client = await getPooledClient(config);

        // Ensure folder exists and handle potential delimiter issues
        // We can use list() to see how the server sees it
        const folders = await client.list();
        let targetFolder = folders.find(f => f.path === mailboxPath);

        // If not found exactly, try fuzzy match (case insensitive or common naming)
        if (!targetFolder) {
            targetFolder = folders.find(f => f.path.toLowerCase() === mailboxPath.toLowerCase());
        }

        const finalPath = targetFolder ? targetFolder.path : mailboxPath;
        console.log(`[email-server] FETCHING FOLDER: "${finalPath}" (Original: "${mailboxPath}")`);

        const lock = await client.getMailboxLock(finalPath);
        const emails = [];

        try {
            // Fetch Status (Unseen count)
            const status = await client.status(mailboxPath, { unseen: true, messages: true });

            if (!status || status.messages === 0) return res.json({ emails: [], total: 0, unseen: 0 });

            // Pagination Logic
            const page = parseInt(req.body.page) || 1;
            const pageSize = parseInt(req.body.pageSize) || 10;
            const total = status.messages;
            const unseen = status.unseen;

            if (total === 0) return res.json({ emails: [], total: 0, unseen: 0 });

            // IMAP ranges are 1-based. 
            // Page 1 (newest): total -> total - pageSize + 1
            // Page 2: total - pageSize -> total - 2*pageSize + 1

            const endIndex = total - (page - 1) * pageSize;
            const startIndex = Math.max(1, endIndex - pageSize + 1);

            if (endIndex < 1) return res.json({ emails: [], total });

            const range = `${startIndex}:${endIndex}`;
            console.log(`[email-server] Fetching range: ${range} (Page ${page}, Size ${pageSize}, Total ${total})`);

            for await (const message of client.fetch(range, { envelope: true, uid: true })) {
                emails.push({
                    uid: message.uid,
                    messageId: message.envelope.messageId,
                    subject: message.envelope.subject || '(Sem Assunto)',
                    from: message.envelope.from?.[0]?.address || 'Desconhecido',
                    date: message.envelope.date,
                    flags: message.flags
                });
            }
            // Sort by date desc
            emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            return res.json({ emails, total, unseen });
        } finally {
            lock.release();
        }
    } catch (err) {
        console.error('[email-server] IMAP List Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// --- FETCH EMAIL BODY (IMAP) ---
const simpleParser = require('mailparser').simpleParser;

app.post('/api/email/fetch-body', authMiddleware, async (req, res) => {
    const uidNum = Number(uid);
    if (!config || !uid) return res.status(400).json({ error: 'Missing config or uid' });

    console.log(`[email-server] FETCH BODY: UID ${uid} in ${mailboxPath}`);

    try {
        const client = await getPooledClient(config);

        // Ensure folder exists and handle potential delimiter issues
        const folders = await client.list();
        let targetFolder = folders.find(f => f.path === mailboxPath);
        if (!targetFolder) {
            targetFolder = folders.find(f => f.path.toLowerCase() === mailboxPath.toLowerCase());
        }
        const finalPath = targetFolder ? targetFolder.path : mailboxPath;

        const lock = await client.getMailboxLock(finalPath);
        try {
            const message = await client.fetchOne(uidNum, { source: true }, { uid: true });
            if (!message) return res.status(404).json({ error: 'Email not found' });

            const parsed = await simpleParser(message.source);

            return res.json({
                text: parsed.text,
                html: parsed.html || parsed.textAsHtml // Fallback if no HTML part
            });
        } finally {
            lock.release();
        }
    } catch (err) {
        console.error('[email-server] IMAP Body Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// --- MANAGE FLAGS (SEEN, FLAGGED, ETC) ---
app.post('/api/email/flags', authMiddleware, async (req, res) => {
    const { config, uids, operation, flags, path } = req.body; // operation: 'add' or 'remove'
    const mailboxPath = path || 'INBOX';
    if (!config || !uids || !operation || !flags) return res.status(400).json({ error: 'Missing parameters' });

    const uidsNum = Array.isArray(uids) ? uids.map(Number) : [Number(uids)];

    try {
        const client = await getPooledClient(config);
        const lock = await client.getMailboxLock(mailboxPath);
        try {
            if (operation === 'add') {
                await client.messageFlagsAdd(uidsNum, flags, { uid: true });
            } else if (operation === 'remove') {
                await client.messageFlagsRemove(uidsNum, flags, { uid: true });
            } else if (operation === 'set') {
                await client.messageFlagsSet(uidsNum, flags, { uid: true });
            }
            return res.json({ success: true });
        } finally {
            lock.release();
        }
    } catch (err) {
        console.error('[email-server] Flags Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// --- MOVE EMAIL ---
app.post('/api/email/move', authMiddleware, async (req, res) => {
    const { config, uids, fromPath, toPath } = req.body;
    const fromMailboxPath = fromPath || 'INBOX';
    if (!config || !uids || !toPath) return res.status(400).json({ error: 'Missing parameters' });

    console.log(`[email-server] MOVE: UIDs ${uids.join(',')} from ${fromMailboxPath} to ${toPath}`);

    try {
        const client = await getPooledClient(config);
        const lock = await client.getMailboxLock(fromMailboxPath);
        try {
            await client.messageMove(uids, toPath, { uid: true });
            return res.json({ success: true });
        } finally {
            lock.release();
        }
    } catch (err) {
        console.error('[email-server] Move Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// --- MANAGE FOLDERS ---
app.post('/api/email/folders', authMiddleware, async (req, res) => {
    const { config, action, path, newPath } = req.body; // action: 'list', 'create', 'rename', 'delete'
    if (!config) return res.status(400).json({ error: 'Missing config' });

    console.log(`[email-server] FOLDERS: Action: ${action} - Path: ${path || 'N/A'} - NewPath: ${newPath || 'N/A'}`);

    try {
        const client = await getPooledClient(config);
        try {
            if (action === 'list') {
                const folders = await client.list();
                return res.json(folders);
            } else if (action === 'create' && path) {
                await client.mailboxCreate(path);
                return res.json({ success: true });
            } else if (action === 'rename' && path && newPath) {
                await client.mailboxRename(path, newPath);
                return res.json({ success: true });
            } else if (action === 'delete' && path) {
                await client.mailboxDelete(path);
                return res.json({ success: true });
            } else {
                return res.status(400).json({ error: 'Invalid action or missing path' });
            }
        } finally {
            // No logout here for pooled clients
        }
    } catch (err) {
        console.error('[email-server] Folders Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase Client (Service Role for backend ops)
// Note: We use process.env vars which should be available
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const supabase = supabaseKey ? createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
}) : null;

// --- SEND EMAIL (SMTP) ---
app.post('/api/email/send', authMiddleware, async (req, res) => {
    const { config, payload, user_id } = req.body; // user_id passed from frontend or decoded from token
    if (!config || !payload) {
        return res.status(400).json({ error: 'Missing config or payload' });
    }

    // Extract recipients for contacts saving
    const recipients = [];
    if (payload.to) recipients.push(...payload.to.split(',').map(e => e.trim()));
    if (payload.cc) recipients.push(...payload.cc.split(',').map(e => e.trim()));
    if (payload.bcc) recipients.push(...payload.bcc.split(',').map(e => e.trim()));

    console.log(`[email-server] SEND: ${config.smtp_host}:${config.smtp_port} -> To: ${payload.to} - Subject: ${payload.subject}`);

    const transporter = nodemailer.createTransport({
        host: config.smtp_host,
        port: ensureNumber(config.smtp_port),
        secure: config.smtp_ssl !== false,
        auth: { user: config.smtp_user, pass: config.smtp_pass },
        tls: { rejectUnauthorized: false }
    });

    try {
        // 1. Send via SMTP
        const info = await transporter.sendMail({
            from: config.smtp_user,
            to: payload.to,
            cc: payload.cc,
            bcc: payload.bcc,
            replyTo: payload.replyTo,
            subject: payload.subject,
            text: payload.text,
            html: payload.html
        });

        // 2. Append to Sent Folder (IMAP)
        // We use a separate async operation for this to valid "sent" status quickly, 
        // but it's safer to wait to ensure consistency.
        try {
            const client = await getPooledClient(config);
            // Try to find the correct Sent folder
            let sentFolder = 'INBOX.Sent'; // Default fallback
            const boxes = await client.list();
            // 1. Try SpecialUse
            const sentBox = boxes.find(b => b.specialUse === '\\Sent');
            if (sentBox) {
                sentFolder = sentBox.path;
            } else {
                // 2. Try common names (Case Insensitive)
                const fuzzySent = boxes.find(b =>
                    b.path.toLowerCase() === 'sent' ||
                    b.path.toLowerCase() === 'sent messages' ||
                    b.path.toLowerCase() === 'enviados' ||
                    b.path.toLowerCase().endsWith('.sent')
                );
                if (fuzzySent) sentFolder = fuzzySent.path;
            }

            console.log(`[email-server] Appending to Sent folder: ${sentFolder}`);

            // Construct MIME message for appending
            // Ideally we'd use the raw message from nodemailer, but info.messageId isn't the raw.
            // We'll reconstruct a simple version or just text.
            // For a robust implementation, we should use a composer lib, but let's try a simple text append first.
            // Better: Nodemailer can return the raw stream if we ask, or we just append the text.
            // Actually, ImapFlow `append` takes a string or buffer.

            // Re-using nodemailer to build raw (but not send) is tricky without a stream.
            // We'll construct a basic MIME string manually for the Append.
            const mimeMessage = [
                `From: ${config.smtp_user}`,
                `To: ${payload.to}`,
                payload.cc ? `Cc: ${payload.cc}` : '',
                `Subject: ${payload.subject}`,
                `Date: ${new Date().toUTCString()}`,
                `Content-Type: text/html; charset=utf-8`,
                '',
                payload.html || payload.text
            ].filter(Boolean).join('\r\n');

            await client.append(sentFolder, mimeMessage, ['\\Seen']);
        } catch (imapErr) {
            console.error('[email-server] Failed to append to Sent:', imapErr);
            // Non-blocking error for the user, but logged.
        }

        // 3. Save Contacts (Fire and Forget)
        if (supabase && user_id) {
            (async () => {
                for (const email of recipients) {
                    if (!email.includes('@')) continue; // Basic validation
                    const cleanEmail = email.replace(/<.*>/, '').trim();
                    const name = email.includes('<') ? email.split('<')[0].trim() : cleanEmail.split('@')[0];

                    try {
                        await supabase.from('email_contacts').upsert({
                            user_id: user_id,
                            email: cleanEmail,
                            name: name
                        }, { onConflict: 'user_id,email' });
                    } catch (dbErr) {
                        console.error('[email-server] Contact save error:', dbErr);
                    }
                }
            })();
        }

        return res.json({ success: true, messageId: info.messageId });
    } catch (err) {
        console.error('[email-server] SMTP Error:', err.message);
        return res.status(500).json({ error: `SMTP Error: ${err.message}` });
    }
});

// --- TEST CONNECTION ---
app.post('/api/email/test', authMiddleware, async (req, res) => {
    const { config } = req.body;
    const results = { imap: false, smtp: false };

    console.log(`[email-server] TEST CONNECTION: IMAP: ${config.imap_host}:${config.imap_port}, SMTP: ${config.smtp_host}:${config.smtp_port}`);

    // Test IMAP
    try {
        const imapClient = await getPooledClient(config);
        results.imap = true;
        console.log('[email-server] IMAP test successful (or reused).');
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
        console.log('[email-server] SMTP test successful.');
    } catch (err) {
        console.error('[email-server] SMTP test failed:', err.message);
    }

    return res.json(results);
});

// --- HEALTH CHECK ---
app.get('/api/email/health', (req, res) => res.json({ status: 'ok' }));
// Also support root /health for direct testing
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
    console.log(`[email-server] Running on port ${PORT}`);
});
