const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Robust .env loading
dotenv.config(); // Default
dotenv.config({ path: path.join(__dirname, '.env'), override: true });
dotenv.config({ path: path.join(__dirname, '../.env'), override: true });
dotenv.config({ path: '/root/pandanet/.env', override: true });
if (!process.env.JWT_SECRET) {
  dotenv.config({ path: '/root/supabase/supabase/docker/.env', override: true });
}

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

const evoUrl = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
const evoKey = process.env.EVOLUTION_API_KEY || 'EvolutionPandaSecret123';
// Public URL or internal Docker network URL so Evolution can reach us
// For internal docker network:
const backendWebhookBaseUrl = process.env.BACKEND_WEBHOOK_URL || 'http://pandanet_backend:3000';

app.set('trust proxy', 1);

// --- Security Middlewares ---
app.use(helmet());
app.use(hpp());

// Rate limit is relaxed for webhooks, apply mostly to frontend-facing API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente em 15 minutos.' }
});

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' })); // Evolution API webhooks can be large

// Fix URL for Docker internal network if localhost is provided
let supabaseUrl = process.env.SUPABASE_URL || '';
if (supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1')) {
  supabaseUrl = supabaseUrl.replace('localhost', 'supabase-kong').replace('127.0.0.1', 'supabase-kong');
}
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey ? supabaseKey.trim() : '');

// --- JWT Auth Middleware for Frontend Requests ---
async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error('[AUTH] Supabase error:', error?.message);
      if (!JWT_SECRET) return res.status(401).json({ error: 'Server misconfigured' });
      try {
        const decodedUser = jwt.verify(token, JWT_SECRET);
        req.user = { id: decodedUser.sub, email: decodedUser.email, role: decodedUser.role };
        return next();
      } catch (jwtErr) {
        console.error('[AUTH] JWT verification failed:', jwtErr.message);
        return res.status(401).json({ error: 'Invalid token (JWT)' });
      }
    }
    req.user = user;
    next();
  } catch (error) {
    console.error('[AUTH] Fatal error:', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.get('/health', (req, res) => res.json({ status: 'ok', evolution_mode: true }));
app.get('/', (req, res) => res.send('WhatsPanda Backend (Evolution Proxy) 🐼'));

// API: Iniciar Sessão
app.use('/sessions', apiLimiter);
app.post('/sessions/:companyId/start/:connectionId', authMiddleware, async (req, res) => {
  const { companyId, connectionId } = req.params;
  const instanceName = `conn_${connectionId}`;
  const webhookUrl = `${backendWebhookBaseUrl}/webhook/evolution/${companyId}/${connectionId}`;

  console.log(`[START] Requisitando Evolution para ${instanceName}...`);

  try {
    // 1. Tenta apagar a instância se já existir para forçar um recomeço limpo
    await fetch(`${evoUrl}/instance/logout/${instanceName}`, {
       method: 'DELETE',
       headers: { 'apikey': evoKey }
    }).catch(() => {});

    await fetch(`${evoUrl}/instance/delete/${instanceName}`, {
       method: 'DELETE',
       headers: { 'apikey': evoKey }
    }).catch(() => {});

    // 2. Cria a instância com webhooks apontando para nós
    const createReq = await fetch(`${evoUrl}/instance/create`, {
        method: 'POST',
        headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
            webhook: true,
            webhookUrl: webhookUrl,
            webhookEvents: ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'MESSAGES_UPSERT']
        })
    });
    
    const createRes = await createReq.json();
    console.log('[EVOLUTION] Instância criada/buscada:', createRes);

    if (createReq.ok || createRes?.instance?.status) {
        // Se ela já não estiver com QR Code engatilhado, chamamos connect (No Evolution API V2/V1 normal o create já gera o QR na resposta, mas o webhook recebe depois)
        // Set explicitly to connecting in Supabase
        await supabase.from('whatsapp_settings').update({ is_connected: false, qr_code: null }).eq('id', connectionId);
        res.json({ status: 'success', message: `Sessão iniciada.` });
    } else {
        res.status(500).json({ error: 'Falha ao criar instância Evolution', detail: createRes });
    }
  } catch (error) {
    console.error('[START] Erro fatal Evolution:', error.message);
    res.status(500).json({ error: 'Evolution indisponível', details: error.message });
  }
});

// API: Parar Sessão
app.post('/sessions/:companyId/stop/:connectionId', authMiddleware, async (req, res) => {
  const { connectionId } = req.params;
  const instanceName = `conn_${connectionId}`;

  try {
    await fetch(`${evoUrl}/instance/logout/${instanceName}`, {
       method: 'DELETE',
       headers: { 'apikey': evoKey }
    });
    await fetch(`${evoUrl}/instance/delete/${instanceName}`, {
       method: 'DELETE',
       headers: { 'apikey': evoKey }
    });
    
    await supabase.from('whatsapp_settings').update({ is_connected: false, qr_code: null }).eq('id', connectionId);
    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deslogar Evolution' });
  }
});


// ============================================
// WEBHOOKS DA EVOLUTION API
// ============================================

app.post('/webhook/evolution/:companyId/:connectionId', async (req, res) => {
    // Responde 200 rápido para a Evolution não travar
    res.status(200).json({ received: true });

    const { companyId, connectionId } = req.params;
    const { event, data, instance } = req.body;

    if (!data) return;
    console.log(`[WEBHOOK] ${event} da inst. ${instance} / Empresa: ${companyId}`);

    // ----- QR CODE ATUALIZADO -----
    if (event === 'qrcode.updated') {
        const qrBase64 = data.qrcode?.base64 || data.base64; // Depende da versão da Evo
        if (qrBase64) {
            console.log(`[WEBHOOK] QR Code recebido, salvando no banco...`);
            await supabase.from('whatsapp_settings').update({ qr_code: qrBase64, is_connected: false }).eq('id', connectionId);
        }
    }

    // ----- STATUS DE CONEXÃO -----
    if (event === 'connection.update') {
        const state = data.state || data.status; // 'connecting', 'open', 'close', 'refused'
        console.log(`[WEBHOOK] Status de Conexão: ${state}`);
        
        if (state === 'open' || state === 'connected') {
            await supabase.from('whatsapp_settings').update({ is_connected: true, qr_code: null }).eq('id', connectionId);
        } else if (state === 'close' || state === 'disconnected' || state === 'refused') {
            await supabase.from('whatsapp_settings').update({ is_connected: false }).eq('id', connectionId);
            // Em auth_failure, a evo exclui a sessão? Se sim, avisar.
        }
    }

    // ----- MENSAGEM RECEBIDA -----
    if (event === 'messages.upsert') {
        const message = data.messages ? data.messages[0] : data.message;
        if (!message) return;

        const isFromMe = message.key?.fromMe;
        if (isFromMe) return; // Ignorando mensagens da própria empresa por enquanto para simplificar o MVP
        
        const remoteJid = message.key?.remoteJid;
        if (!remoteJid || remoteJid.includes('@g.us')) return; // Ignorar grupos por enquanto
        
        const fromPhone = remoteJid.split('@')[0];
        
        // Texto formatado pela Evolution
        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || 
                     message.text || 
                     "";

        if (!text) return; // Se for áudio/imagem, pula no MVP

        const contactName = message.pushName || fromPhone;
        const msgId = message.key?.id;

        console.log(`[WEBHOOK] Msg recebida de ${fromPhone}: ${text}`);

        // 1. Procurar ou criar Conversa
        let { data: conv } = await supabase
            .from('whatsapp_conversations')
            .select('id, unread_count')
            .eq('company_id', companyId)
            .eq('contact_phone', fromPhone)
            .single();

        let conversationId = conv?.id;

        if (!conv) {
            const { data: newConv } = await supabase
                .from('whatsapp_conversations')
                .insert({
                    company_id: companyId,
                    contact_phone: fromPhone,
                    contact_name: contactName,
                    status: 'aberto',
                    unread_count: 1,
                    connection_id: connectionId,
                    last_message_at: new Date().toISOString()
                }).select().single();
            conversationId = newConv?.id;
        } else {
            await supabase
                .from('whatsapp_conversations')
                .update({
                    unread_count: (conv.unread_count || 0) + 1,
                    last_message_at: new Date().toISOString()
                }).eq('id', conversationId);
        }

        // 2. Inserir a mensagem
        if (conversationId) {
            await supabase.from('whatsapp_messages').insert({
                conversation_id: conversationId,
                message_text: text,
                is_from_customer: true,
                whatsapp_message_id: msgId,
                created_at: new Date().toISOString()
            });
        }
    }
});

app.listen(port, () => {
  console.log(`🚀 Servidor WhatsPanda (Evolution Proxy) rodando na porta ${port}`);
});
