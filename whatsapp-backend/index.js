const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { analyzeMessageForTransfer } = require('./utils/geminiService');

// Robust .env loading
dotenv.config(); // Default
dotenv.config({ path: path.join(__dirname, '.env'), override: true });
dotenv.config({ path: path.join(__dirname, '../.env'), override: true });
dotenv.config({ path: path.join(__dirname, '../.env.local'), override: true });
dotenv.config({ path: '/root/pandanet/.env', override: true });
if (!process.env.JWT_SECRET) {
  dotenv.config({ path: '/root/supabase/supabase/docker/.env', override: true });
}

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

let evoUrl = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
let evoKey = process.env.EVOLUTION_API_KEY || 'EvolutionPandaSecret123';
// Public URL or internal Docker network URL so Evolution can reach us
// For internal docker network:
const backendWebhookBaseUrl = process.env.BACKEND_WEBHOOK_URL || 'http://whatsapp-backend:3000';

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

if (evoUrl.includes('localhost') || evoUrl.includes('127.0.0.1')) {
    evoUrl = evoUrl.replace('localhost', 'evolution-api').replace('127.0.0.1', 'evolution-api');
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
      } catch (jwtErr) {
        console.error('[AUTH] JWT verification failed:', jwtErr.message);
        return res.status(401).json({ error: 'Invalid token (JWT)' });
      }
    } else {
      req.user = user;
    }

    // --- Enterprise Isolation Validation ---
    const { companyId } = req.params;
    if (companyId) {
      // Fetch profile to check permissions and company_id
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('company_id, role, is_admin, is_company_admin')
        .eq('id', req.user.id)
        .single();

      if (profileErr || !profile) {
        // Special case for Master Admin TI email if profile doesn't exist yet
        const isMasterAdmin = req.user.email?.toLowerCase() === 'ti@grupopixel.com.br';
        if (!isMasterAdmin) {
          console.error('[AUTH] Profile not found or error:', profileErr?.message);
          return res.status(403).json({ error: 'Forbidden: Profile not found' });
        }
        // Master Admin can use any companyId
      } else {
        const isMasterAdmin = profile.role === 'Super Admin' || req.user.email?.toLowerCase() === 'ti@grupopixel.com.br';
        const isCompanyAdmin = profile.is_company_admin || profile.is_admin;
        
        // If not Master and trying to access another company
        if (!isMasterAdmin && profile.company_id !== companyId) {
          console.warn(`[AUTH] Access denied: User ${req.user.id} (Company ${profile.company_id}) tried to access Company ${companyId}`);
          return res.status(403).json({ error: 'Forbidden: Cross-company access denied' });
        }
      }
    }

    next();
  } catch (error) {
    console.error('[AUTH] Fatal error:', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.get('/health', (req, res) => res.json({ status: 'ok', evolution_mode: true }));
app.get('/', (req, res) => res.send('WhatsPanda Backend (Evolution Proxy) 🐼'));

// --- ROUTES ---
const router = express.Router();

// API: Iniciar Sessão
router.post('/sessions/:companyId/start/:connectionId', authMiddleware, async (req, res) => {
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
            webhook: webhookUrl,
            events: ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'MESSAGES_UPSERT']
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
router.post('/sessions/:companyId/stop/:connectionId', authMiddleware, async (req, res) => {
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

// API: Sincronizar
router.post('/sync/:companyId/:connectionId', authMiddleware, async (req, res) => {
    const { companyId, connectionId } = req.params;
    
    try {
        console.log(`[SYNC-API] Requisição recebida. Empresa: ${companyId}, Conexão: ${connectionId}`);

        if (!companyId || !connectionId) {
            return res.status(400).json({ error: 'Parâmetros companyId e connectionId são obrigatórios' });
        }

        // Verificar conexão no banco garantindo que pertence à empresa (Multi-tenancy check)
        const { data: settings, error } = await supabase
            .from('whatsapp_settings')
            .select('id, company_id')
            .eq('id', connectionId)
            .eq('company_id', companyId) // CRITICAL: Security re-check
            .maybeSingle();
        
        if (error) {
            console.error('[SYNC-API] Erro ao validar conexão:', error.message);
            return res.status(500).json({ error: 'Erro interno ao validar permissão de conexão', details: error.message });
        }

        if (!settings) {
            console.warn(`[SYNC-API] Tentativa de sincronizar conexão ${connectionId} que não pertence à empresa ${companyId}`);
            return res.status(403).json({ error: 'Você não tem permissão para sincronizar esta conexão ou ela não existe.' });
        }

        const instanceName = `conn_${connectionId}`;
        
        // Disparar sincronização em background
        syncEvolutionData(instanceName, companyId, connectionId).catch(err => {
            console.error(`[SYNC-API] Erro em background para ${instanceName}:`, err.message);
        });
        
        res.json({ status: 'success', message: 'Sincronização iniciada com sucesso em segundo plano' });
    } catch (err) {
        console.error('[SYNC-API] Erro fatal:', err);
        res.status(500).json({ 
            error: 'Erro interno ao processar sincronização',
            details: err.message
        });
    }
});

// API: Enviar Mensagem
router.post('/messages/send/:conversationId', authMiddleware, async (req, res) => {
    const { conversationId } = req.params;
    const { message } = req.body;
    const userId = req.user?.id; // from authMiddleware

    if (!message) {
        return res.status(400).json({ error: 'Message text is required' });
    }

    try {
        // 1. Get conversation details (contact phone, connection id, company id)
        const { data: conv, error: convErr } = await supabase
            .from('whatsapp_conversations')
            .select('*')
            .eq('id', conversationId)
            .single();

        if (convErr || !conv) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // --- Security Check: Validate user ownership ---
        const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', userId).single();
        const isMaster = profile?.role === 'Super Admin' || req.user.email?.toLowerCase() === 'ti@grupopixel.com.br';
        if (!isMaster && profile?.company_id !== conv.company_id) {
            console.warn(`[SEND API] Unauthorized send attempt by user ${userId} in conversation ${conversationId}`);
            return res.status(403).json({ error: 'Forbidden: You do not have access to this conversation' });
        }

        const instanceName = `conn_${conv.connection_id}`;
        if (!conv.connection_id) {
            return res.status(400).json({ error: 'WhatsApp instance not found for this conversation' });
        }

        // 2. Send via Evolution API
        const sendReq = await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                number: conv.contact_phone,
                text: message,
                textMessage: {
                    text: message
                }
            })
        });

        let sendRes;
        try {
            sendRes = await sendReq.json();
        } catch (e) {
            sendRes = { error: 'Invalid response from Evolution API' };
        }

        if (!sendReq.ok || (sendRes.error && !sendRes.key)) {
            console.error('[SEND API] Erro ao enviar na Evolution. Status:', sendReq.status, 'Body:', sendRes);
            return res.status(500).json({ error: 'Failed to send message via WhatsApp', details: sendRes });
        }

        // 3. Save message in Supabase
        const { data: newMsg, error: msgErr } = await supabase
            .from('whatsapp_messages')
            .insert({
                company_id: conv.company_id,
                conversation_id: conversationId,
                message_text: message,
                is_from_customer: false,
                sent_by: userId,
                whatsapp_message_id: sendRes?.key?.id || undefined
            })
            .select()
            .single();

        if (msgErr) {
            console.error('[SEND API] Erro ao salvar mensagem no Supabase:', msgErr);
        }
        
        // 4. Update conversation timestamp
        await supabase
            .from('whatsapp_conversations')
            .update({ 
                last_message_at: new Date().toISOString(),
                status: (conv.status === 'fechado' || conv.status === 'pendente') ? 'aberto' : conv.status,
                assigned_to: (conv.status === 'pendente' && !conv.assigned_to) ? userId : conv.assigned_to
            })
            .eq('id', conversationId);

        res.json({ status: 'success', message: newMsg || { message_text: message, is_from_customer: false, sent_by: userId } });
    } catch (error) {
        console.error('[SEND API] Erro fatal:', error.message);
        res.status(500).json({ error: 'Internal server error while sending message' });
    }
});

// API: Reparar Webhooks
router.post('/repair-webhooks/:companyId/:connectionId', authMiddleware, async (req, res) => {
    const { companyId, connectionId } = req.params;
    const instanceName = `conn_${connectionId}`;
    const webhookUrl = `${backendWebhookBaseUrl}/webhook/evolution/${companyId}/${connectionId}`;

    console.log(`[REPAIR] Atualizando webhook para ${instanceName} -> ${webhookUrl}`);

    try {
        const repairReq = await fetch(`${evoUrl}/webhook/set/${instanceName}`, {
            method: 'POST',
            headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                enabled: true,
                url: webhookUrl,
                events: ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'SEND_MESSAGE']
            })
        });

        const repairRes = await repairReq.json();
        res.json({ status: 'success', detail: repairRes });
    } catch (error) {
        console.error('[REPAIR] Erro:', error.message);
        res.status(500).json({ error: 'Falha ao reparar webhook', details: error.message });
    }
});

app.use('/whatsapp', router);
app.use('/', router); // Manter fallback para as rotas antigas se necessário


// ============================================
// WEBHOOKS DA EVOLUTION API E SYNC
// ============================================

async function syncEvolutionData(instanceName, companyId, connectionId) {
    try {
        console.log(`[SYNC] Iniciando syncEvolutionData para ${instanceName}...`);
        
        // 1. Buscar Chats (Conversas ativas, incluindo grupos)
        // O endpoint findChats é o mais completo para recuperar o estado atual do celular
        const chatEp = `${evoUrl}/chat/findChats/${instanceName}`;
        console.log(`[SYNC] Buscando chats via: ${chatEp}`);
        
        const response = await fetch(chatEp, {
            method: 'GET',
            headers: { 'apikey': evoKey, 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`Falha ao buscar chats: ${response.status}`);
        }

        const chats = await response.json();
        
        if (!Array.isArray(chats)) {
            console.error(`[SYNC] Resposta inválida da Evolution (esperado array):`, JSON.stringify(chats));
            return;
        }

        console.log(`[SYNC] ${chats.length} chats encontrados em ${instanceName}.`);

        const contactsToUpsert = [];
        const conversationsToUpsert = [];
        const processedJids = new Set();

        for (const chat of chats) {
            const jid = chat.id || chat.remoteJid || chat.jid;
            if (!jid || processedJids.has(jid)) continue;
            processedJids.add(jid);

            const isGroup = jid.includes('@g.us');
            const phone = isGroup ? jid : jid.split('@')[0];
            const name = chat.name || chat.pushName || chat.contact?.name || phone;

            // Preparar Contato
            contactsToUpsert.push({
                company_id: companyId,
                phone: phone,
                name: name,
                updated_at: new Date().toISOString()
            });

            // Preparar Conversa (se houve mensagem)
            // Se o chat tem 'lastMessage', usamos o timestamp dela
            const lastMsgAt = chat.messageTimestamp 
                ? new Date(chat.messageTimestamp * 1000).toISOString() 
                : new Date().toISOString();

            conversationsToUpsert.push({
                company_id: companyId,
                connection_id: connectionId,
                contact_name: name,
                contact_phone: phone,
                status: 'aberto', // Chats sincronizados entram como abertos
                last_message_at: lastMsgAt,
                unread_count: chat.unreadCount || 0
            });
        }


        // 2. Fallback: Buscar Contatos se chats vierem vazios ou para garantir lista completa
        if (chats.length === 0) {
            console.log(`[SYNC] findChats retornou vazio. Tentando fetchContacts...`);
            try {
                // A Evolution v1.x costuma ter /contact/fetchContacts como POST ou GET dependendo da build
                const contactRes = await fetch(`${evoUrl}/contact/findAll/${instanceName}`, {
                    method: 'GET',
                    headers: { 'apikey': evoKey }
                });
                if (contactRes.ok) {
                    const allContacts = await contactRes.json();
                    if (Array.isArray(allContacts)) {
                        console.log(`[SYNC] ${allContacts.length} contatos encontrados via findAll.`);
                        for (const c of allContacts) {
                            const jid = c.id || c.jid;
                            if (!jid || processedJids.has(jid)) continue;
                            processedJids.add(jid);
                            const phone = jid.split('@')[0];
                            contactsToUpsert.push({
                                company_id: companyId,
                                phone: phone,
                                name: c.name || c.pushName || c.verifiedName || phone,
                                updated_at: new Date().toISOString()
                            });
                        }
                    }
                }
            } catch (e) {
                console.error('[SYNC] Erro no fallback de contatos:', e.message);
            }
        }

        // 3. Upsert de Contatos
        if (contactsToUpsert.length > 0) {
            console.log(`[SYNC] Upsert de ${contactsToUpsert.length} contatos...`);
            const { error: errC } = await supabase
                .from('whatsapp_contacts')
                .upsert(contactsToUpsert, { onConflict: 'company_id,phone' });
            if (errC) console.error('[SYNC] Erro contatos:', errC.message);
        }

        // 3. Upsert de Conversas
        if (conversationsToUpsert.length > 0) {
            console.log(`[SYNC] Upsert de ${conversationsToUpsert.length} conversas...`);
            // Nota: whatsapp_conversations usa company_id, connection_id e contact_phone como critério de busca
            // Mas o upsert real depende da constraint do banco. Geralmente id ou um índice único.
            // Para evitar duplicatas, vamos iterar e garantir que não criamos 2 conversas pro mesmo número na mesma conexão.
            
            for (const conv of conversationsToUpsert) {
                // Verificar se já existe
                const { data: existing } = await supabase
                    .from('whatsapp_conversations')
                    .select('id')
                    .eq('company_id', companyId)
                    .eq('connection_id', connectionId)
                    .eq('contact_phone', conv.contact_phone)
                    .maybeSingle();

                if (existing) {
                    await supabase
                        .from('whatsapp_conversations')
                        .update({ 
                            last_message_at: conv.last_message_at,
                            unread_count: conv.unread_count,
                            contact_name: conv.contact_name
                        })
                        .eq('id', existing.id);
                } else {
                    await supabase
                        .from('whatsapp_conversations')
                        .insert(conv);
                }
            }
        }

        console.log(`[SYNC] Sincronização de ${instanceName} concluída.`);
    } catch (err) {
        console.error(`[SYNC] Erro fatal em syncEvolutionData:`, err.message);
    }
}


async function runChatbot(message, conversation, companyId, connectionId) {
    try {
        const text = (message.message?.conversation || message.message?.extendedTextMessage?.text || message.text || "").trim().toLowerCase();
        if (!text) return;

        // 1. Buscar fluxo ativo
        const { data: flow } = await supabase
            .from('whatsapp_chatbot_flows')
            .select('*')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .maybeSingle();
        if (!flow) return;

        let currentNodeId = conversation.chatbot_node_id;
        let node;

        if (!currentNodeId) {
            // Iniciar com o node de saudação (tipo 'greeting')
            const { data: greetingNode } = await supabase
                .from('whatsapp_chatbot_nodes')
                .select('*')
                .eq('flow_id', flow.id)
                .eq('type', 'greeting')
                .maybeSingle();
            node = greetingNode;
        } else {
            // Verificar resposta para o node atual (se for menu)
            const { data: currentNode } = await supabase
                .from('whatsapp_chatbot_nodes')
                .select('*')
                .eq('id', currentNodeId)
                .single();
            
            if (currentNode?.type === 'menu') {
                const options = currentNode.content?.options || [];
                // Tenta achar opção por número ou texto
                const selectedOption = options.find(opt => 
                    text === opt.label.toLowerCase() || 
                    text === (options.indexOf(opt) + 1).toString()
                );

                if (selectedOption) {
                    const { data: nextNode } = await supabase
                        .from('whatsapp_chatbot_nodes')
                        .select('*')
                        .eq('id', selectedOption.next_node)
                        .maybeSingle();
                    node = nextNode;
                } else {
                    // Repetir menu se opção inválida
                    node = currentNode;
                }
            } else {
                // Se não for menu, talvez apenas avançar ou reiniciar? 
                // Para simplificar: se não for menu e estiver preso num node, reiniciar no greeting se mandou algo novo
                const { data: greetingNode } = await supabase
                    .from('whatsapp_chatbot_nodes')
                    .select('*')
                    .eq('flow_id', flow.id)
                    .eq('type', 'greeting')
                    .maybeSingle();
                node = greetingNode;
            }
        }

        if (node) {
            // Processar ações do node
            if (node.type === 'transfer_queue') {
                const queueId = node.content?.queue_id;
                await supabase.from('whatsapp_conversations').update({ 
                    queue_id: queueId, 
                    chatbot_node_id: null 
                }).eq('id', conversation.id);
            } else if (node.type === 'transfer_user') {
                const userId = node.content?.user_id;
                await supabase.from('whatsapp_conversations').update({ 
                    assigned_to: userId, 
                    chatbot_node_id: null 
                }).eq('id', conversation.id);
            } else {
                // Node de mensagem ou menu: Enviar resposta e salvar estado
                const replyText = node.content?.text || "";
                if (replyText) {
                    // Enviar resposta usando as URLs e chaves globais
                    const instanceName = `conn_${connectionId}`;
                    await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
                            method: 'POST',
                            headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                number: conversation.contact_phone,
                                text: replyText
                            })
                        }).catch(e => console.error('[CHATBOT] Erro ao enviar msg:', e.message));

                        // Salvar msg enviada pelo bot no banco
                        await supabase.from('whatsapp_messages').insert({
                            company_id: companyId,
                            conversation_id: conversation.id,
                            message_text: replyText,
                            is_from_customer: false,
                            sent_by: null // 'null' indica que foi o bot
                        });
                }
                await supabase.from('whatsapp_conversations').update({ chatbot_node_id: node.id }).eq('id', conversation.id);
            }
        }
    } catch (err) {
        console.error('[CHATBOT] Erro fatal:', err.message);
    }
}

async function processInboundMessage(message, companyId, connectionId, isHistorical = false) {
    try {
        const isFromMe = message.key?.fromMe;
        const remoteJid = message.key?.remoteJid;
        if (!remoteJid || remoteJid.includes('@g.us')) return;
        
        const fromPhone = remoteJid.split('@')[0];
        const msgId = message.key?.id;

        // 0. Verificar se o contato está bloqueado
        const { data: contact } = await supabase
            .from('whatsapp_contacts')
            .select('is_blocked')
            .eq('company_id', companyId)
            .eq('phone', fromPhone)
            .maybeSingle();

        if (contact?.is_blocked) {
            console.log(`[BOT] Mensagem ignorada: Contato ${fromPhone} está bloqueado.`);
            return;
        }

        // Verificar se mensagem já existe
        const { data: exists, error: existErr } = await supabase
            .from('whatsapp_messages')
            .select('id')
            .eq('whatsapp_message_id', msgId)
            .limit(1)
            .maybeSingle();
        
        if (existErr) {
            console.error(`[MSG] Erro ao verificar existência:`, existErr.message);
        }
        if (exists) {
            console.log(`[MSG] Mensagem ${msgId} já processada. Ignorando.`);
            return;
        }

        // Extrair texto e mídia
        let text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text || 
            message.text || "";

        let mediaUrl = null;
        let mediaType = null;

        const m = message.message || {};
        const mediaMsg = m.imageMessage || m.audioMessage || m.videoMessage || m.documentMessage || m.stickerMessage;

        if (mediaMsg) {
            mediaType = m.imageMessage ? 'image' : m.audioMessage ? 'audio' : m.videoMessage ? 'video' : 'file';
            // Evolution API usually returns the internal URL/path. If they don't provide a public one, we might need to fetch it.
            // For now, we'll try to use the message text or a placeholder if evolution doesn't provide URL directly in upsert.
            if (!text) text = `[Mídia: ${mediaType}]`;
        }

        if (!text && !mediaMsg) return;

        // 1. Localizar conversa (Usar limit(1) por segurança contra duplicatas históricas)
        let { data: conv, error: convErr } = await supabase
            .from('whatsapp_conversations')
            .select('id, unread_count, queue_id, assigned_to')
            .eq('company_id', companyId)
            .eq('contact_phone', fromPhone)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (convErr) {
            console.error(`[MSG] Erro ao buscar conversa para ${fromPhone}:`, convErr.message);
        }

        let conversationId = conv?.id;

        if (!conv) {
            console.log(`[MSG] Criando nova conversa para ${fromPhone}...`);
            const contactName = message.pushName || fromPhone;
            const { data: newConv, error: createErr } = await supabase
                .from('whatsapp_conversations')
                .insert({
                    company_id: companyId,
                    contact_phone: fromPhone,
                    contact_name: contactName,
                    status: 'pendente',
                    unread_count: isHistorical ? 0 : 1,
                    connection_id: connectionId,
                    last_message_at: new Date().toISOString()
                }).select().single();
            
            if (createErr) {
                console.error(`[MSG] Erro CRÍTICO ao criar conversa:`, createErr.message);
                // Se falhou, tenta buscar novamente por via das dúvidas
                const { data: retryConv } = await supabase.from('whatsapp_conversations')
                    .select('id').eq('company_id', companyId).eq('contact_phone', fromPhone).maybeSingle();
                conversationId = retryConv?.id;
            } else {
                conversationId = newConv?.id;
            }
        } else if (!isHistorical) {
            // Se a conversa estava fechada, ela deve reabrir como pendente
            const newStatus = conv.status === 'fechado' ? 'pendente' : conv.status;
            
            await supabase
                .from('whatsapp_conversations')
                .update({
                    unread_count: (conv.unread_count || 0) + 1,
                    last_message_at: new Date().toISOString(),
                    status: newStatus
                }).eq('id', conversationId);
        }

        // 2. Inserir a mensagem
        if (conversationId) {
            console.log(`[MSG] Inserindo mensagem. FromCustomer: ${!isFromMe} | De: ${fromPhone}`);
            const { error: insErr } = await supabase.from('whatsapp_messages').insert({
                company_id: companyId,
                conversation_id: conversationId,
                message_text: text,
                is_from_customer: !isFromMe,
                whatsapp_message_id: msgId,
                media_url: mediaUrl,
                media_type: mediaType,
                created_at: message.messageTimestamp ? new Date(message.messageTimestamp * 1000).toISOString() : new Date().toISOString()
            });
            if (insErr) {
                console.error(`[MSG] Erro ao inserir msg ${msgId}:`, insErr.message);
            } else {
                if (!isHistorical) {
                    console.log(`[MSG] Mensagem ${msgId} salva com sucesso.`);
                    
                    // Garantir que a conversa seja atualizada mesmo se for de saída (fromMe)
                    // Isso ajuda o usuário a ver o que enviou por outro dispositivo
                    if (isFromMe) {
                         await supabase.from('whatsapp_conversations').update({
                            last_message_at: new Date().toISOString()
                        }).eq('id', conversationId);
                    }

                    // Disparar Chatbot se for do cliente e não for histórico
                    if (!isFromMe) {
                        // 5. Executar Roteamento Inteligente Gemini (se habilitado)
                        if (!conv || (!conv.queue_id && !conv.user_id)) { 
                            try {
                                const { data: settings } = await supabase
                                    .from('whatsapp_settings')
                                    .select('gemini_api_key')
                                    .eq('company_id', companyId)
                                    .limit(1)
                                    .single();

                                if (settings?.gemini_api_key) {
                                    const { data: queues } = await supabase.from('whatsapp_queues').select('id, name').eq('company_id', companyId);
                                    const suggestedQueueId = await analyzeMessageForTransfer(text, queues || [], settings.gemini_api_key);

                                    if (suggestedQueueId) {
                                        console.log(`[GEMINI] Sugestão de transferência para fila ${suggestedQueueId}`);
                                        await supabase.from('whatsapp_conversations').update({ 
                                            queue_id: suggestedQueueId,
                                            status: 'pending'
                                        }).eq('id', conversationId);
                                        
                                        await supabase.from('whatsapp_messages').insert({
                                            conversation_id: conversationId,
                                            company_id: companyId,
                                            message_text: `[🤖 IA] Atendimento movido para a fila: ${queues.find(q => q.id === suggestedQueueId)?.name}`,
                                            is_from_me: true,
                                            is_system: true
                                        });
                                    }
                                }
                            } catch (geminiErr) {
                                console.error('[GEMINI] Erro no roteamento:', geminiErr.message);
                            }
                        }

                        // 6. Rodar Chatbot Legado
                        runChatbot(message, conv || { id: conversationId, contact_phone: fromPhone }, companyId, connectionId);
                    }
                }
            }
        }
    } catch (err) {
        console.error('[MSG] Erro fatal:', err.message);
    }
}

app.post('/webhook/evolution/:companyId/:connectionId', async (req, res) => {
    // Responde 200 rápido para a Evolution não travar
    res.status(200).json({ received: true });

    const { companyId, connectionId } = req.params;
    const { event, data, instance } = req.body;

    console.log(`[WEBHOOK] Evento: ${event} | Instância: ${instance} | Empresa: ${companyId}`);
    
    // Log detalhado para MESSAGES_UPSERT ajuda a identificar se a Evolution está enviando o que esperamos
    if (event === 'messages.upsert') {
        console.log(`[WEBHOOK] Detalhes do Payload MESSAGES_UPSERT:`, JSON.stringify(data, null, 2));
    } else {
        console.log(`[WEBHOOK RAW] Payload:`, JSON.stringify(req.body, null, 2));
    }

    if (!data) {
        console.log(`[WEBHOOK] Recebido evento ${event} sem dados anexados.`);
        return;
    }
    console.log(`[WEBHOOK] Processando ${event} para Empresa: ${companyId}`);

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

            // Disparar sincronização em background
            syncEvolutionData(instance, companyId, connectionId);
        } else if (state === 'close' || state === 'disconnected' || state === 'refused') {
            await supabase.from('whatsapp_settings').update({ is_connected: false }).eq('id', connectionId);
            // Em auth_failure, a evo exclui a sessão? Se sim, avisar.
        }
    }

    // ----- MENSAGEM RECEBIDA -----
    if (event === 'messages.upsert') {
        const message = data.messages ? data.messages[0] : data.message;
        if (!message) return;

        await processInboundMessage(message, companyId, connectionId);
    }
});


app.listen(port, () => {
  console.log(`🚀 Servidor WhatsPanda (Evolution Proxy) rodando na porta ${port}`);
});
