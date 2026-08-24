const express = require('express');
const cors = require('cors');
const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config(); // Load from server/ directory
require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true });
require('dotenv').config({ path: path.join(__dirname, '../.env.local'), override: true });
require('dotenv').config({ path: '/root/pandanet/.env', override: true }); // VPS path

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

// --- Security Middlewares ---
app.use(helmet()); // Basic security headers
app.use(hpp());    // Prevent HTTP Parameter Pollution

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Limit each IP to 500 requests per windowMs (Higher for internal use)
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas requisições deste IP. Tente novamente em 15 minutos.' }
});

app.use(limiter);
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- JWT Auth Middleware ---
function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('[auth] Email: Missing or invalid Authorization header');
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    const token = authHeader.split(' ')[1];
    try {
        if (!JWT_SECRET) {
            console.error('[auth] JWT_SECRET is undefined!');
            return res.status(500).json({ error: 'Internal Auth Configuration Error' });
        }
        jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        console.error('[auth] Email: Token verification failed:', err.message);
        return res.status(401).json({ error: 'Invalid or expired token: ' + err.message });
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

// --- SEARCH EMAILS (GLOBAL) ---
app.post('/api/email/search', authMiddleware, async (req, res) => {
    const { config, query } = req.body;
    if (!config || !query) return res.status(400).json({ error: 'Missing config or query' });

    console.log(`[email-server] GLOBAL SEARCH: "${query}" for ${config.imap_user}`);

    try {
        const client = await getPooledClient(config);
        const folders = await client.list();
        const allResults = [];

        for (const folder of folders) {
            // Skip Trash and Spam for global search unless specified? 
            // The user said "all emails, inbox and folders". 
            // I'll skip common trash/spam folders to keep results relevant, but include most.
            const lcPath = folder.path.toLowerCase();
            if (lcPath.includes('trash') || lcPath.includes('lixeira') || lcPath.includes('spam') || lcPath.includes('junk')) {
                continue;
            }

            const lock = await client.getMailboxLock(folder.path);
            try {
                // Search for current query in Subject, From, To or Body
                const searchCriteria = {
                    or: [
                        { subject: query },
                        { from: query },
                        { to: query },
                        { body: query }
                    ]
                };

                const uids = await client.search(searchCriteria);
                if (uids.length > 0) {
                    // Fetch details for found UIDs
                    // Limit to newest 20 per folder to avoid timeout/bloat
                    const sortedUids = uids.sort((a, b) => b - a).slice(0, 20);
                    
                    for await (const message of client.fetch(sortedUids, { envelope: true, uid: true, source: true })) {
                        const parsed = await simpleParser(message.source);
                        const snippet = parsed.text ? parsed.text.substring(0, 100).replace(/\s+/g, ' ') : '';
                        
                        allResults.push({
                            uid: message.uid,
                            messageId: message.envelope.messageId,
                            subject: message.envelope.subject || '(Sem Assunto)',
                            from: message.envelope.from?.[0]?.address || 'Desconhecido',
                            to: message.envelope.to || [],
                            cc: message.envelope.cc || [],
                            date: message.envelope.date,
                            flags: message.flags,
                            snippet: snippet + (snippet.length === 100 ? '...' : ''),
                            folder: folder.path
                        });
                    }
                }
            } catch (folderErr) {
                console.warn(`[email-server] Search failed in folder ${folder.path}:`, folderErr.message);
            } finally {
                lock.release();
            }
        }

        // Sort results by date desc across all folders
        allResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return res.json({ emails: allResults, total: allResults.length });
    } catch (err) {
        console.error('[email-server] Global Search Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

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

            for await (const message of client.fetch(range, { envelope: true, uid: true, source: true })) {
                // Generate a simple snippet by parsing the source briefly or just first part
                const parsed = await simpleParser(message.source);
                const snippet = parsed.text ? parsed.text.substring(0, 100).replace(/\s+/g, ' ') : '';

                emails.push({
                    uid: message.uid,
                    messageId: message.envelope.messageId,
                    subject: message.envelope.subject || '(Sem Assunto)',
                    from: message.envelope.from?.[0]?.address || 'Desconhecido',
                    to: message.envelope.to || [],
                    cc: message.envelope.cc || [],
                    date: message.envelope.date,
                    flags: message.flags,
                    snippet: snippet + (snippet.length === 100 ? '...' : '')
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
    const { config, uid, path } = req.body;
    const mailboxPath = path || 'INBOX';
    const uidStr = String(uid);

    if (!config || !uid) return res.status(400).json({ error: 'Missing config or uid' });

    console.log(`[email-server] FETCH BODY: UID ${uidStr} in ${mailboxPath}`);

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
            const message = await client.fetchOne(uidStr, { source: true }, { uid: true });
            if (!message) return res.status(404).json({ error: 'Email not found' });

            const parsed = await simpleParser(message.source);

            const attachments = (parsed.attachments || []).map((att, index) => ({
                id: index,
                filename: att.filename || 'Sem nome',
                contentType: att.contentType,
                size: att.size,
                partId: index // We'll use the index for simplicity in this pooled client setup
            }));

            return res.json({
                text: parsed.text,
                html: parsed.html || parsed.textAsHtml,
                attachments,
                cc: parsed.cc?.value || [],
                to: parsed.to?.value || [],
                from: parsed.from?.value || [],
                subject: parsed.subject,
                messageId: parsed.messageId,
                date: parsed.date
            });
        } finally {
            lock.release();
        }
    } catch (err) {
        console.error(`[email-server] IMAP Body Error (UID: ${uid}, Folder: ${mailboxPath}):`, err.message);
        if (err.stack) console.error(err.stack);
        return res.status(500).json({ error: `Erro ao buscar corpo do e-mail: ${err.message}` });
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

    // ImapFlow expects a sequence string (e.g. "1,2,3") or a single sequence string
    const uidsStr = Array.isArray(uids) ? uids.join(',') : String(uids);
    console.log(`[email-server] MOVE: UIDs [${uidsStr}] from ${fromMailboxPath} to ${toPath}`);

    try {
        const client = await getPooledClient(config);
        const lock = await client.getMailboxLock(fromMailboxPath);
        try {
            await client.messageMove(uidsStr, toPath, { uid: true });
            console.log(`[email-server] Successfully moved UIDs [${uidsStr}]`);
            return res.json({ success: true });
        } finally {
            lock.release();
        }
    } catch (err) {
        console.error('[email-server] Move Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// --- ATTACHMENT DOWNLOAD ---
app.post('/api/email/attachment', authMiddleware, async (req, res) => {
    const { config, uid, path, attachmentId } = req.body;
    if (!config || !uid || attachmentId === undefined) return res.status(400).json({ error: 'Missing parameters' });

    try {
        const client = await getPooledClient(config);
        const lock = await client.getMailboxLock(path || 'INBOX');
        try {
            const message = await client.fetchOne(String(uid), { source: true }, { uid: true });
            if (!message) return res.status(404).json({ error: 'Email not found' });

            const parsed = await simpleParser(message.source);
            const attachment = parsed.attachments[attachmentId];

            if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

            res.setHeader('Content-Type', attachment.contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
            return res.send(attachment.content);
        } finally {
            lock.release();
        }
    } catch (err) {
        console.error('[email-server] Attachment Error:', err.message);
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
    console.log(`[email-server] SEND PAYLOAD: html_len=${(payload.html || '').length}, text_len=${(payload.text || '').length}, attachments=${(payload.attachments || []).length}`);

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
            html: payload.html,
            attachments: payload.attachments || [] // Add attachments support
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
                const fuzzySent = boxes.find(b => {
                    const lcPath = b.path.toLowerCase();
                    return lcPath === 'sent' ||
                        lcPath === 'sent items' ||
                        lcPath === 'sent messages' ||
                        lcPath === 'enviados' ||
                        lcPath === 'itens enviados' ||
                        lcPath.includes('.sent') ||
                        lcPath.includes(' sent') ||
                        lcPath.includes('enviad');
                });
                if (fuzzySent) sentFolder = fuzzySent.path;
            }

            console.log(`[email-server] Appending to Sent folder: ${sentFolder}`);

            // Construct MIME message for appending
            // Use nodemailer lib's built-in MailComposer for robust formatting
            const MailComposer = require('nodemailer/lib/mail-composer');
            const mail = new MailComposer({
                from: config.smtp_user,
                to: payload.to,
                cc: payload.cc,
                bcc: payload.bcc,
                replyTo: payload.replyTo,
                subject: payload.subject,
                text: payload.text,
                html: payload.html,
                attachments: payload.attachments || []
            });

            const mimeMessageBuffer = await mail.compile().build();
            const mimeMessageStr = mimeMessageBuffer.toString('utf8');

            await client.append(sentFolder, mimeMessageStr, ['\\Seen']);
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

// --- SAVE DRAFT (IMAP) ---
app.post('/api/email/save-draft', authMiddleware, async (req, res) => {
    const { config, payload } = req.body;
    if (!config || !payload) return res.status(400).json({ error: 'Missing config or payload' });

    console.log(`[email-server] SAVE DRAFT: ${config.imap_host} -> Subject: ${payload.subject}`);
    console.log(`[email-server] SAVE DRAFT PAYLOAD: html_len=${(payload.html || '').length}, text_len=${(payload.text || '').length}`);

    try {
        const client = await getPooledClient(config);

        // Detect Drafts Folder
        let draftFolder = 'INBOX.Drafts'; // Default
        const boxes = await client.list();
        const draftBox = boxes.find(b => b.specialUse === '\\Drafts') ||
            boxes.find(b => ['Drafts', 'Rascunhos', 'Brouillons'].some(name => b.path.toLowerCase().includes(name.toLowerCase())));

        if (draftBox) draftFolder = draftBox.path;

        const MailComposer = require('nodemailer/lib/mail-composer');
        const mail = new MailComposer({
            from: config.imap_user || config.smtp_user,
            to: payload.to,
            subject: payload.subject,
            text: payload.text,
            html: payload.html,
            attachments: payload.attachments || []
        });

        const mimeMessageBuffer = await mail.compile().build();
        const mimeMessageStr = mimeMessageBuffer.toString('utf8');

        await client.append(draftFolder, mimeMessageStr, ['\\Draft']);
        return res.json({ success: true, folder: draftFolder });
    } catch (err) {
        console.error('[email-server] Save Draft Error:', err.message);
        return res.status(500).json({ error: err.message });
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
app.get('/api/email/health', (req, res) => res.json({ status: 'ok', secret_loaded: !!JWT_SECRET }));
// Also support root /health for direct testing
app.get('/health', (req, res) => res.json({ status: 'ok', secret_loaded: !!JWT_SECRET }));

app.listen(PORT, () => {
    console.log(`[email-server] Running on port ${PORT}`);
});
