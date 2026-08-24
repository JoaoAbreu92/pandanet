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

async function connectToWhatsApp(companyId) {
    if (!companyId) {
        console.error('connectToWhatsApp: companyId is required');
        return;
    }

    console.log(`Starting WhatsApp session for company: ${companyId}`);

    // Create specific auth folder for this company
    const authPath = `auth_info_baileys/${companyId}`;
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
            await updateCompanySettings(companyId, { qr_code: qr, is_connected: false });
            console.log('[QR CODE] QR Code saved to DB successfully');
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            await updateCompanySettings(companyId, { is_connected: false });

            // Remove from sessions map on close
            sessions.delete(companyId);

            if (shouldReconnect) {
                // connectToWhatsApp(); // Recursive call might be dangerous if not handled carefully, but standard in Baileys examples
                // For this structure, we might need a better reconnection strategy or let the main loop handle it.
                // But since we are inside the function, we can just call it? 
                // Better to let the process restart in docker or handle it cleanly.
                // For now, let's try calling it again.
                connectToWhatsApp(companyId);
            } else {
                console.log('Connection closed. You are logged out.');
                // delete auth info if needed
                await updateCompanySettings(companyId, { is_connected: false, qr_code: null });
                sessions.delete(companyId);
            }
        } else if (connection === 'open') {
            console.log('opened connection for company', companyId);
            await updateCompanySettings(companyId, { is_connected: true, qr_code: null });
            sessions.set(companyId, sock);
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
            await handleIncomingMessage(sock, msg, from, contactName, text, new Date(), false, companyId);
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
        await handleIncomingMessage(null, msg, from, contactName, text, new Date(ts), isFromMe, companyId);
        count++;
    }
    console.log(`Synced ${count} messages from last 30 days.`);
}

// Helper to update settings in DB
async function updateCompanySettings(companyId, updates) {
    if (!companyId) return;
    
    // Upsert equivalent logic
    const { data, error } = await supabase
        .from('whatsapp_settings')
        .select('id')
        .eq('company_id', companyId)
        .single();
    
    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching settings:', error);
        return;
    }

    if (!data) {
        // Insert
        await supabase.from('whatsapp_settings').insert({
            company_id: companyId,
            ...updates
        });
    } else {
        // Update
        await supabase
            .from('whatsapp_settings')
            .update(updates)
            .eq('company_id', companyId);
        console.log(`[updateCompanySettings] Updated settings for company ${companyId}:`, updates);
    }
}

async function handleIncomingMessage(sock, msg, from, contactName, text, timestamp = new Date(), isFromMe = false, companyId) {
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
        const { data: newConv, error: createError } = await supabase
            .from('whatsapp_conversations')
            .insert({
                company_id: companyId,
                contact_phone: from,
                contact_name: contactName,
                status: 'aberto', // or 'pendente' default
                unread_count: 1,
                last_message_at: new Date().toISOString()
            })
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
