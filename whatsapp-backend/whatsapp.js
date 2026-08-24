const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { createClient } = require('@supabase/supabase-js');
const pino = require('pino');
const dotenv = require('dotenv');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const path = require('path');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use Service Key for backend

if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase URL or Service Key missing in .env');
    // process.exit(1);
} else {
    console.log('--- DB CONNECTION DEBUG ---');
    console.log('Supabase URL:', supabaseUrl);
    console.log('Key (first 10 chars):', supabaseKey ? supabaseKey.trim().substring(0, 10) + '...' : 'MISSING');
}

const supabase = createClient(supabaseUrl, supabaseKey.trim());

// Map to store socket connections for multiple companies
const sessions = new Map();
// Map to track reconnection attempts
const reconnectionAttempts = new Map();
const MAX_RECONNECTION_ATTEMPTS = 10;

async function connectToWhatsApp(companyId, connectionId) {
    if (!companyId || !connectionId) {
        console.error('connectToWhatsApp: companyId and connectionId are required');
        return;
    }

    console.log(`Starting WhatsApp session for connection: ${connectionId} (Company: ${companyId})`);

    // Create specific auth folder for this connection
    const authPath = path.join(__dirname, 'auth_info_baileys', connectionId);

    // Se a pasta não existe, vamos garantir que o diretório pai existe
    const parentAuthPath = path.join(__dirname, 'auth_info_baileys');
    if (!fs.existsSync(parentAuthPath)) {
        fs.mkdirSync(parentAuthPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    
    console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: ['WhatsPanda', 'Chrome', '1.0.0'],
        // markOnlineOnConnect: false,
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('[QR CODE] QR Code received. Please scan!');
            console.log('[QR CODE] Saving to DB for company:', companyId);
            qrcode.generate(qr, { small: true });
            // Save QR status to DB
            await updateCompanySettings(connectionId, { qr_code: qr, is_connected: false });
            console.log('[QR CODE] QR Code saved to DB successfully');

            // Timeout de 60 segundos para forçar refresh do QR Code se não for lido
            if (sessions.has(connectionId + '_timer')) {
                clearTimeout(sessions.get(connectionId + '_timer'));
            }

            const timer = setTimeout(async () => {
                console.log(`[TIMEOUT] QR Code expiro para a conexao ${connectionId}. Reiniciando sessão para gerar novo QR...`);
                await updateCompanySettings(connectionId, { qr_code: null, is_connected: false });
                sock.ev.removeAllListeners();
                sock.end(new Error('QR_TIMEOUT'));
                sessions.delete(connectionId);
                sessions.delete(connectionId + '_timer');

                // Força reconexão após 2 segundos
                setTimeout(() => {
                    connectToWhatsApp(companyId, connectionId);
                }, 2000);
            }, 60000); // 60 segundos

            sessions.set(connectionId + '_timer', timer);
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);

            // Set as disconnected immediately
            await updateCompanySettings(connectionId, { is_connected: false });
            sessions.delete(connectionId);

            if (shouldReconnect) {
                // Se foi um erro de expiração de QR Code ou queda anormal:
                // 1. Limpa a pasta auth para forçar um novo login do zero
                try {
                    const authPath = `auth_info_baileys/${connectionId}`;
                    if (fs.existsSync(authPath)) {
                        fs.rmSync(authPath, { recursive: true, force: true });
                        console.log(`[AUTO-FIX] Deleted auth folder to force fresh QR code: ${authPath}`);
                    }
                } catch (err) {
                    console.error('[AUTO-FIX] Failed to delete auth folder:', err);
                }

                // 2. Tenta reconectar (agora que a pasta sumiu, ele vai gerar um QR novo)
                const attempts = reconnectionAttempts.get(connectionId) || 0;
                if (attempts < MAX_RECONNECTION_ATTEMPTS) {
                    reconnectionAttempts.set(connectionId, attempts + 1);
                    console.log(`[RECONNECTION] Attempt ${attempts + 1}/${MAX_RECONNECTION_ATTEMPTS} for connection ${connectionId}`);

                    // Delay para evitar loopings infernais instantâneos
                    setTimeout(() => {
                        connectToWhatsApp(companyId, connectionId);
                    }, 5000); // 5 segundos antes de tentar gerar novo QR ou reconectar
                } else {
                    console.log(`[RECONNECTION] Max attempts (${MAX_RECONNECTION_ATTEMPTS}) reached for connection ${connectionId}. Stopping.`);
                    reconnectionAttempts.delete(connectionId);
                }
            } else {
                console.log('Connection closed. You are logged out (or session corrupted). Action required by user.');
            }
        } else if (connection === 'connecting') {
            console.log(`[CONNECTING] O celular começou a parear para a conexão ${connectionId}...`);
            // CANCELAR O TIMER DE EXPIRAÇÃO DE QR CODE PARA NÃO MATAR NO MEIO DO PAREAMENTO LENTO DO CELULAR
            if (sessions.has(connectionId + '_timer')) {
                console.log(`[PAREAMENTO] Cancelando timer de timeout, pareamento em andamento...`);
                clearTimeout(sessions.get(connectionId + '_timer'));
                sessions.delete(connectionId + '_timer');
            }
        } else if (connection === 'open') {
            console.log('opened connection for connection', connectionId);

            // Garanja extra de limpar timer se chegou ao open direto
            if (sessions.has(connectionId + '_timer')) {
                console.log(`[SUCCESS] Cancelando timer de timeout para a conexao ${connectionId}`);
                clearTimeout(sessions.get(connectionId + '_timer'));
                sessions.delete(connectionId + '_timer');
            }

            await updateCompanySettings(connectionId, { is_connected: true, qr_code: null });
            sessions.set(connectionId, sock);
            // Reset reconnection attempts on successful connection
            reconnectionAttempts.delete(connectionId);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        // console.log(JSON.stringify(m, undefined, 2));
        const msg = m.messages[0];
        if (!msg.message) return; // if it is a status update or something else
        if (msg.key.fromMe) return; // ignore my own messages for now (or handle them differently)

        const from = msg.key.remoteJid;
        const contactName = msg.pushName || from.split('@')[0];
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (!text) return; // Ignore non-text messages for MVP

        console.log(`Received message from ${from}: ${text}`);

        // Save to Supabase
        try {
            await handleIncomingMessage(sock, msg, from, contactName, text, new Date(), false, companyId, connectionId);
        } catch (e) {
            console.error('Error handling message:', e);
        }
    });
    
    // --- NEW: Call Handling ---
    sock.ev.on('call', async (node) => {
        const { id, from, status } = node[0];
        if (status === 'offer') {
            // Fetch settings
            const { data: settings } = await supabase
                .from('whatsapp_settings')
                .select('reject_calls, rejection_message')
                .eq('company_id', companyId)
                .single();

            if (settings?.reject_calls) {
                console.log(`Rejecting call from ${from}`);
                await sock.rejectCall(id, from);
                if (settings.rejection_message) {
                    await sock.sendMessage(from, { text: settings.rejection_message });
                }
            }
        }
    });

    // --- NEW: History & Contact Sync ---
    sock.ev.on('messaging-history.set', async ({ contacts, messages, isLatest }) => {
        console.log(`Syncing history: ${contacts.length} contacts, ${messages.length} chats`);
        
        // 1. Sync Contacts
        const contactsToUpsert = contacts.map(c => ({
            company_id: companyId,
            id: c.id, // we might need to map this to our internal ID or use phone as ID. 
                      // Wait, our 'whatsapp_contacts' uses uuid as ID? 
                      // actually, checking schema... we likely use uuid. 
                      // For sync, we need to match by phone.
            name: c.name || c.notify || c.id.split('@')[0],
            phone: c.id.split('@')[0],
            // ... other fields
        }));

        // We need a helper to Upsert contacts by Phone
        for (const c of contactsToUpsert) {
            await upsertContact(companyId, c);
        }

        // 2. Sync Messages (Last 30 Days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        for (const chat of messages) {
            // chat is the conversation object, messages are inside? 
            // Baileys structure: messages is usually an array of { ... } linked to a chat?
            // Actually 'messages' in history.set is: { chatId: messages[] } ? No, checking docs..
            // It's usually `chats` and `messages`.
            // The signature is `{ chats, contacts, messages, isLatest }`
            // Wait, I used destructuring `{ contacts, messages }` above.
            // `messages` is an array of WAProto.IWebMessageInfo (raw messages)
            
            // Filter by date
            // const msgDate = new Date(msg.messageTimestamp * 1000);
            // if (msgDate < thirtyDaysAgo) continue;
            
            // To be safe and simple for this snippet, let's process them.
            // But `messages` is an array of messages.
        }
        
        // Since iterating thousands of messages might be slow here, let's just log for now?
        // User requested import. I will implement a simplified version.
        
        // Actually, let's use a helper function for clarity
        await syncHistory(companyId, contacts, messages);
    });

    sock.ev.on('contacts.upsert', async (contacts) => {
        for (const c of contacts) {
            await upsertContact(companyId, {
                name: c.name || c.notify,
                phone: c.id.split('@')[0]
            });
        }
    });

    return sock;
}

// --- Helpers ---

async function upsertContact(companyId, contact) {
    if (!contact.phone) return;
    
    // Check if exists
    const { data: existing } = await supabase
        .from('whatsapp_contacts')
        .select('id')
        .eq('company_id', companyId)
        .eq('phone', contact.phone)
        .single();

    if (!existing) {
        await supabase.from('whatsapp_contacts').insert({
            company_id: companyId,
            name: contact.name || contact.phone,
            phone: contact.phone
        });
    } else if (contact.name) {
        // Optional: Update name if changed?
        await supabase.from('whatsapp_contacts').update({ name: contact.name }).eq('id', existing.id);
    }
}

async function syncHistory(companyId, contacts, messages) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. Sync Contacts first
    for (const c of contacts) {
        await upsertContact(companyId, {
            name: c.name || c.notify,
            phone: c.id.split('@')[0]
        });
    }

    // 2. Sync Messages
    console.log('Starting Message Sync...');
    let count = 0;
    
    // messages is array of { ...message details... }
    for (const msg of messages) {
        if (!msg.messageTimestamp) continue;
        const ts = (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : msg.messageTimestamp.low) * 1000;
        if (new Date(ts) < thirtyDaysAgo) continue;

        const from = msg.key.remoteJid;
        const isFromMe = msg.key.fromMe;
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

        if (!text) continue; // Skip media for MVP

        const contactName = msg.pushName || 'Desconhecido';
        
        // reuse handleIncomingMessage? 
        // We modify handleIncomingMessage to accept timestamp and 'isFromMe'
        await handleIncomingMessage(null, msg, from, contactName, text, new Date(ts), isFromMe, companyId, null);
        count++;
    }
    console.log(`Synced ${count} messages from last 30 days.`);
}

// Helper to update settings in DB
async function updateCompanySettings(connectionId, updates) {
    console.log(`[updateCompanySettings] Connection ID: ${connectionId}`);

    // Trap for debugging
    if (updates.hasOwnProperty('qr_code') && updates.qr_code === null) {
        console.warn('⚠️ [updateCompanySettings] WARNING: Setting qr_code to NULL!');
    }

    console.log(`[updateCompanySettings] Updates:`, JSON.stringify(updates, null, 2));

    try {
        const { data, error } = await supabase
            .from('whatsapp_settings')
            .update(updates)
            .eq('id', connectionId)
            .select();

        if (error) {
            console.error('[updateCompanySettings] ❌ SUPABASE ERROR:', error);
        } else {
            console.log('[updateCompanySettings] ✅ SUPABASE SUCCESS:', JSON.stringify(data));
        }
    } catch (err) {
        console.error('[updateCompanySettings] ⚠️ UNEXPECTED ERROR:', err);
    }
}

async function handleIncomingMessage(sock, msg, from, contactName, text, timestamp = new Date(), isFromMe = false, companyId, connectionId) {
    if (!companyId) {
        console.log('Skipping DB save: companyId not set');
        return;
    }

    // 1. Get or Create Conversation
    let conversationId;
    
    // Check if conversation exists
    let { data: conv, error: convError } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('company_id', companyId)
        .eq('contact_phone', from)
        .single();

    if (convError && convError.code !== 'PGRST116') { // PGRST116 is "Row not found"
        console.error('Error searching conversation:', convError);
        return;
    }

    if (!conv) {
        // Create new conversation
        const insertData = {
            company_id: companyId,
            contact_phone: from,
            contact_name: contactName,
            status: 'aberto', // or 'pendente' default
            unread_count: 1,
            last_message_at: new Date().toISOString()
        };
        if (connectionId) {
            insertData.connection_id = connectionId;
        }

        const { data: newConv, error: createError } = await supabase
            .from('whatsapp_conversations')
            .insert(insertData)
            .select()
            .single();
        
        if (createError) {
             console.error('Error creating conversation:', createError);
             return;
        }
        conversationId = newConv.id;
        console.log('Created new conversation:', conversationId);
    } else {
        conversationId = conv.id;
        // Update unread count and last message
        await supabase
            .from('whatsapp_conversations')
            .update({
                unread_count: (conv.unread_count || 0) + 1,
                last_message_at: new Date().toISOString(),
                // Re-open if closed?
                // status: conv.status === 'fechado' ? 'aberto' : conv.status
            })
            .eq('id', conversationId);
    }

    // 2. Insert Message
    const { error: msgError } = await supabase
        .from('whatsapp_messages')
        .insert({
            conversation_id: conversationId,
            message_text: text,
            is_from_customer: !isFromMe,
            whatsapp_message_id: msg.key.id,
            created_at: timestamp.toISOString()
        });

    if (msgError) console.error('Error saving message:', msgError);
    else console.log('Message saved to DB');
}


module.exports = { connectToWhatsApp, sessions, updateCompanySettings };
