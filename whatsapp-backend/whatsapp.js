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
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Map to store socket connections for multiple companies (if needed in future, current implementation for single instance/company)
// For MVP, we assume one backend instance per company or handle single session.
// Ideally, we'd load session data based on company_id, but here we start simple.
// Let's assume this backend serves ONE company for now, or use a dynamic session loader.
// For this plan, sticking to local file auth state 'auth_info_baileys'.

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
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

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('QR Code received. Please scan!');
            // Save QR status to DB?
            // await updateCompanySettings({ qr_code: qr, is_connected: false });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            // await updateCompanySettings({ is_connected: false });
            if (shouldReconnect) {
                connectToWhatsApp();
            } else {
                console.log('Connection closed. You are logged out.');
                // delete auth info if needed
            }
        } else if (connection === 'open') {
            console.log('opened connection');
            // await updateCompanySettings({ is_connected: true, qr_code: null });
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

        // TODO: Save to Supabase
        // 1. Find or create conversation
        // 2. Insert message
        try {
           await handleIncomingMessage(sock, msg, from, contactName, text);
        } catch (e) {
            console.error('Error handling message:', e);
        }
    });
    
    return sock;
}

// Helper to update settings in DB (mockup for now as we don't have company_id easily)
// We might need to fetch company_id from a config or env
const COMPANY_ID = process.env.COMPANY_ID;

async function updateCompanySettings(updates) {
    if (!COMPANY_ID) return;
    const { error } = await supabase
        .from('whatsapp_settings')
        .update(updates)
        .eq('company_id', COMPANY_ID);
    
    if (error) console.error('Error updating settings:', error);
}

async function handleIncomingMessage(sock, msg, from, contactName, text) {
    if (!COMPANY_ID) {
        console.log('Skipping DB save: COMPANY_ID not set');
        return;
    }

    // 1. Get or Create Conversation
    let conversationId;
    
    // Check if conversation exists
    let { data: conv, error: convError } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('company_id', COMPANY_ID)
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
                company_id: COMPANY_ID,
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
            is_from_customer: true,
            whatsapp_message_id: msg.key.id,
            // sent_by: null // system/customer
        });

    if (msgError) console.error('Error saving message:', msgError);
    else console.log('Message saved to DB');
}


module.exports = { connectToWhatsApp }; // Export function
