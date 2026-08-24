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
// Função de Suporte: Formatar Números de Telefone (ex: 5541999999999 -> +55 41 99999-9999)
function formatPhoneDisplay(phoneStr) {
    if (!phoneStr) return "Desconhecido";
    let clean = phoneStr.replace(/\D/g, '');
    if (clean.length === 12 && clean.startsWith('55')) {
        return `+${clean.slice(0,2)} ${clean.slice(2,4)} ${clean.slice(4,8)}-${clean.slice(8)}`;
    } else if (clean.length === 13 && clean.startsWith('55')) {
        return `+${clean.slice(0,2)} ${clean.slice(2,4)} ${clean.slice(4,9)}-${clean.slice(9)}`;
    }
    return phoneStr;
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
    // 1. Tenta JWT local PRIMEIRO (rápido, sem rede, funciona dentro do Docker)
    if (JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = { id: decoded.sub, email: decoded.email, role: decoded.role };
        console.log(`[AUTH] JWT local OK para user: ${req.user.email || req.user.id}`);
      } catch (jwtErr) {
        // JWT inválido, tenta Supabase como fallback
        console.warn('[AUTH] JWT local falhou, tentando Supabase:', jwtErr.message);
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
          console.error('[AUTH] Supabase também falhou:', error?.message);
          return res.status(401).json({ error: 'Token inválido. Faça login novamente.' });
        }
        req.user = user;
        console.log(`[AUTH] Supabase auth OK para user: ${req.user.email}`);
      }
    } else {
      // Sem JWT_SECRET configurado, usa apenas Supabase
      console.warn('[AUTH] JWT_SECRET não configurado! Usando apenas Supabase auth.');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        console.error('[AUTH] Supabase error (sem JWT_SECRET):', error?.message);
        return res.status(401).json({ error: 'Servidor mal configurado ou token inválido.' });
      }
      req.user = user;
    }

    // --- Validação de Isolamento Multi-tenant ---
    const { companyId } = req.params;
    if (companyId) {
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('company_id, role, is_admin, is_company_admin')
        .eq('id', req.user.id)
        .single();

      if (profileErr || !profile) {
        const isMasterAdmin = req.user.email?.toLowerCase() === 'ti@grupopixel.com.br';
        if (!isMasterAdmin) {
          console.error('[AUTH] Perfil não encontrado:', profileErr?.message);
          return res.status(403).json({ error: 'Forbidden: Perfil não encontrado' });
        }
      } else {
        const isMasterAdmin = profile.role === 'Super Admin' || req.user.email?.toLowerCase() === 'ti@grupopixel.com.br';
        if (!isMasterAdmin && profile.company_id !== companyId) {
          console.warn(`[AUTH] Acesso negado: User ${req.user.id} (Empresa ${profile.company_id}) tentou acessar Empresa ${companyId}`);
          return res.status(403).json({ error: 'Forbidden: Acesso a outra empresa negado' });
        }
      }
    }

    next();
  } catch (error) {
    console.error('[AUTH] Erro fatal no middleware:', error.message);
    return res.status(401).json({ error: 'Erro de autenticação interno' });
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
    const { message, mediaUrl, mediaType } = req.body;
    const userId = req.user?.id; // from authMiddleware

    if (!message && !mediaUrl) {
        return res.status(400).json({ error: 'Message text or media is required' });
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

        // Garantir que o número está limpo e tem código do país
        let phoneNumber = (conv.contact_phone || '').replace(/\D/g, '');
        
        // Validar tamanho do número (Brasil: 12-13 dígitos com DDI 55)
        if (phoneNumber.length > 13 || phoneNumber.length < 10) {
            console.error(`[SEND API] Número inválido: "${phoneNumber}" (${phoneNumber.length} dígitos). Contato pode ter sido importado com erro de sincronização.`);
            return res.status(400).json({ 
                error: 'Número de telefone inválido', 
                details: `O número "${conv.contact_phone}" não é um número WhatsApp válido. Delete este contato/conversa e sincronize novamente.` 
            });
        }
        
        if (!phoneNumber.startsWith('55') && phoneNumber.length <= 11) {
            phoneNumber = '55' + phoneNumber;
        }
        console.log(`[SEND API] Enviando para: ${phoneNumber} | Instância: ${instanceName}`);

        // 2. Send via Evolution API
        let sendRes = null;
        let sendOk = false;

        // Função auxiliar para mapear MIME types para tipos da Evolution API
        const getEvoMediaType = (mime) => {
            if (!mime) return 'document';
            if (mime.startsWith('image/')) return 'image';
            if (mime.startsWith('video/')) return 'video';
            if (mime.startsWith('audio/')) return 'audio';
            return 'document';
        };

        if (mediaUrl) {
            // Se for figurinha MAS for GIF, melhor tratar como mídia imagem (Evolution converte melhor no celular)
            const isGif = mediaUrl.toLowerCase().endsWith('.gif');
            const isSticker = mediaType === 'sticker' && !isGif;
            const endpoint = isSticker ? 'sendSticker' : 'sendMedia';
            
            const body = isSticker ? {
                number: phoneNumber,
                stickerMessage: {
                    sticker: mediaUrl
                }
            } : {
                number: phoneNumber,
                mediaMessage: {
                    mediatype: isGif ? 'image' : getEvoMediaType(mediaType), // GIFs são mediatype image na Evolution
                    caption: message || '',
                    media: mediaUrl
                }
            };

            const sendReq = await fetch(`${evoUrl}/message/${endpoint}/${instanceName}`, {
                method: 'POST',
                headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            
            try { sendRes = await sendReq.json(); } catch(e) { sendRes = {}; }
            console.log(`[SEND API] Resposta ${endpoint} (${sendReq.status}):`, JSON.stringify(sendRes));
            if (sendReq.ok && !sendRes?.error) sendOk = true;

        } else {
            // Tenta formato v1 PRIMEIRO (textMessage) - é o que esta versão da Evo requer
            const sendReqV1 = await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
                method: 'POST',
                headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: phoneNumber, textMessage: { text: message } })
            });
            try { sendRes = await sendReqV1.json(); } catch(e) { sendRes = {}; }
            console.log(`[SEND API] Resposta textMessage (${sendReqV1.status}):`, JSON.stringify(sendRes));

            if (sendReqV1.ok && !sendRes?.error) {
                sendOk = true;
            } else {
                // Tenta formato v2 como fallback (text direto)
                const sendReqV2 = await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
                    method: 'POST',
                    headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ number: phoneNumber, text: message })
                });
                try { sendRes = await sendReqV2.json(); } catch(e) { sendRes = {}; }
                console.log(`[SEND API] Resposta text (${sendReqV2.status}):`, JSON.stringify(sendRes));
                if (sendReqV2.ok && !sendRes?.error) sendOk = true;
            }
        }

        if (!sendOk) {
            const detail = sendRes?.response?.message || sendRes;
            console.error('[SEND API] FALHA NO ENVIO:', JSON.stringify(detail));
            
            // Verifica se o número não existe no WhatsApp
            console.error(`[SEND FAILURE] Erro retornado pela Evolution API:`, JSON.stringify(sendRes));
            return res.status(500).json({ 
                error: 'Falha ao enviar mensagem via WhatsApp (Evolution API)', 
                details: sendRes,
                evolutionStatus: sendRes?.status || 'desconhecido'
            });
        }

        // 3. Save message in Supabase
        const { data: newMsg, error: msgErr } = await supabase
            .from('whatsapp_messages')
            .insert({
                company_id: conv.company_id,
                conversation_id: conversationId,
                message_text: message,
                media_url: mediaUrl || undefined,
                media_type: mediaType || undefined,
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
        const contactMap = {};

        // Evolution API v2 usa POST com body para buscar contatos/chats
        // Tenta GET e POST para cobrir v1 e v2
        const contactEndpoints = [
            { method: 'POST', url: `${evoUrl}/contact/findContacts/${instanceName}`, body: { where: {} } },
            { method: 'POST', url: `${evoUrl}/contact/findAll/${instanceName}`, body: {} },
            { method: 'GET',  url: `${evoUrl}/contact/findContacts/${instanceName}`, body: null },
            { method: 'GET',  url: `${evoUrl}/contact/findAll/${instanceName}`, body: null },
        ];

        for (const ep of contactEndpoints) {
            try {
                console.log(`[SYNC] Tentando ${ep.method} ${ep.url}`);
                const fetchOpts = {
                    method: ep.method,
                    headers: { 'apikey': evoKey, 'Content-Type': 'application/json' }
                };
                if (ep.body !== null) fetchOpts.body = JSON.stringify(ep.body);
                
                const res = await fetch(ep.url, fetchOpts);
                if (!res.ok) { console.log(`[SYNC] Retornou ${res.status}. Tentando próximo...`); continue; }
                
                const raw = await res.json();
                const list = Array.isArray(raw) ? raw : (raw.contacts || raw.data || []);
                
                if (list.length > 0) {
                    console.log(`[SYNC] ${list.length} contatos encontrados!`);
                    for (const c of list) {
                        const jid = c.remoteJid || c.jid || c.id || '';
                        if (!jid || jid.includes('@g.us') || jid.includes('@lid')) continue;
                        const phone = jid.split('@')[0];
                        const name = c.pushName || c.verifiedName || c.name || c.notify || null;
                        if (name) contactMap[phone] = name;
                    }
                    if (Object.keys(contactMap).length > 0) break;
                }
            } catch(e) {
                console.error(`[SYNC] Erro no endpoint:`, e.message);
            }
        }
        console.log(`[SYNC] Total de nomes mapeados: ${Object.keys(contactMap).length}`);

        // Buscar Chats
        const chatEndpoints = [
            { method: 'POST', url: `${evoUrl}/chat/findChats/${instanceName}`, body: {} },
            { method: 'GET',  url: `${evoUrl}/chat/findChats/${instanceName}`, body: null },
            { method: 'POST', url: `${evoUrl}/chat/findAll/${instanceName}`, body: {} },
            { method: 'GET',  url: `${evoUrl}/chat/findAll/${instanceName}`, body: null },
        ];

        const contactsToUpsert = [];
        const processedJids = new Set();

        for (const [phone, cName] of Object.entries(contactMap)) {
            processedJids.add(phone);
            contactsToUpsert.push({ company_id: companyId, phone, name: cName, updated_at: new Date().toISOString() });
        }

        for (const chatEp of chatEndpoints) {
            try {
                console.log(`[SYNC] Tentando ${chatEp.method} ${chatEp.url}`);
                const fetchOpts = {
                    method: chatEp.method,
                    headers: { 'apikey': evoKey, 'Content-Type': 'application/json' }
                };
                if (chatEp.body !== null) fetchOpts.body = JSON.stringify(chatEp.body);
                
                const response = await fetch(chatEp.url, fetchOpts);
                if (!response.ok) { console.log(`[SYNC] Chat retornou ${response.status}.`); continue; }

                const raw = await response.json();
                const chats = Array.isArray(raw) ? raw : (raw.chats || raw.data || []);

                if (chats.length > 0) {
                    console.log(`[SYNC] ${chats.length} chats encontrados.`);
                    for (const chat of chats) {
                        // Ignorar broadcasts e @lid (IDs internos), mas PERMITIR grupos (@g.us)
                        if (!jid || jid.includes('@broadcast') || jid.includes('@lid')) continue;
                        const isGroup = jid.includes('@g.us');
                        const phone = jid.split('@')[0];
                        if (processedJids.has(phone)) continue;
                        processedJids.add(phone);

                        const rawName = isGroup 
                            ? (chat.subject || chat.name || 'Grupo Sem Nome')
                            : (chat.pushName || chat.verifiedName || chat.name || contactMap[phone]);
                        const name = rawName || formatPhoneDisplay(phone);
                        contactsToUpsert.push({ 
                            company_id: companyId, 
                            phone, 
                            name, 
                            is_group: isGroup,
                            updated_at: new Date().toISOString() 
                        });
                    }
                    break;
                }
            } catch(e) {
                console.error(`[SYNC] Erro em chat endpoint:`, e.message);
            }
        }

        if (contactsToUpsert.length > 0) {
            console.log(`[SYNC] Upsert de ${contactsToUpsert.length} contatos...`);
            const batchSize = 100;
            for (let i = 0; i < contactsToUpsert.length; i += batchSize) {
                const batch = contactsToUpsert.slice(i, i + batchSize);
                const { error: errC } = await supabase
                    .from('whatsapp_contacts')
                    .upsert(batch, { onConflict: 'company_id,phone' });
                if (errC) console.error('[SYNC] Erro ao upsert:', errC.message);
            }
            console.log(`[SYNC] Contatos sincronizados!`);
        } else {
            console.log(`[SYNC] Nenhum contato encontrado. Verifique os logs acima para o endpoint correto.`);
        }

        console.log(`[SYNC] Concluído para ${instanceName}.`);
    } catch (err) {
        console.error(`[SYNC] Erro fatal:`, err.message);
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
        let remoteJid = message.key?.remoteJid || '';
        
        // Ignorar broadcasts mas permitir grupos e @lid
        if (!remoteJid || remoteJid.includes('@broadcast')) return;
        const isGroup = remoteJid.includes('@g.us');
        
        // extrair telefone real
        let fromPhone;
        if (remoteJid.includes('@lid')) {
            const senderPn = message.key?.senderPn || message.senderPn || '';
            if (senderPn) {
                fromPhone = senderPn.split('@')[0];
            } else {
                console.log(`[MSG] JID @lid sem senderPn. Ignorando.`);
                return;
            }
        } else {
            fromPhone = remoteJid.split('@')[0];
        }

        const msgId = message.key?.id;
        const pushName = message.pushName || message.contact?.name || message.verifiedName || null;

        // Auto-criar contato para indivíduos (não grupos)
        if (!isFromMe && fromPhone && !isGroup) {
            const contactName = pushName || formatPhoneDisplay(fromPhone);
            await supabase
                .from('whatsapp_contacts')
                .upsert(
                    { company_id: companyId, phone: fromPhone, name: contactName, updated_at: new Date().toISOString() },
                    { onConflict: 'company_id,phone', ignoreDuplicates: false }
                );
        }

        // 0. Verificar se o contato está bloqueado
        if (!isGroup) {
            const { data: contact } = await supabase
                .from('whatsapp_contacts')
                .select('is_blocked')
                .eq('company_id', companyId)
                .eq('phone', fromPhone)
                .maybeSingle();

            if (contact?.is_blocked) {
                console.log(`[BOT] Contato ${fromPhone} bloqueado.`);
                return;
            }
        }

        // Verificar duplicata
        const { data: exists } = await supabase
            .from('whatsapp_messages')
            .select('id')
            .eq('whatsapp_message_id', msgId)
            .maybeSingle();
        
        if (exists) return;

        // Extrair texto
        let text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text || 
            message.text || "";

        let mediaUrl = null;
        let mediaType = null;
        const m = message.message || {};
        const mediaMsg = m.imageMessage || m.audioMessage || m.videoMessage || m.documentMessage || m.stickerMessage;

        if (mediaMsg) {
            mediaType = m.imageMessage ? 'image' : m.audioMessage ? 'audio' : m.videoMessage ? 'video' : 'file';
            if (!text) text = `[Mídia: ${mediaType}]`;
        }

        if (!text && !mediaMsg) return;

        // 1. Localizar ou Criar Conversa
        let { data: conv } = await supabase
            .from('whatsapp_conversations')
            .select('*')
            .eq('company_id', companyId)
            .eq('contact_phone', fromPhone)
            .maybeSingle();

        let conversationId;
        if (!conv) {
            // Se for grupo, abre direto como "aberto" (sem pendente individual)
            const initialStatus = isGroup ? 'aberto' : 'pendente';
            const { data: newConv, error: createErr } = await supabase
                .from('whatsapp_conversations')
                .insert({
                    company_id: companyId,
                    contact_phone: fromPhone,
                    contact_name: pushName || (isGroup ? (message.subject || 'Grupo') : formatPhoneDisplay(fromPhone)),
                    status: initialStatus,
                    unread_count: isHistorical ? 0 : 1,
                    connection_id: connectionId,
                    is_group: isGroup,
                    last_message_at: new Date().toISOString()
                }).select().single();
            
            if (createErr) throw createErr;
            conv = newConv;
            conversationId = newConv.id;
        } else {
            conversationId = conv.id;
            if (!isHistorical) {
                // Reabrir se estiver fechada
                let nextStatus = conv.status;
                if (conv.status === 'fechado' && !isFromMe) {
                    nextStatus = conv.assigned_to ? 'aberto' : 'pendente';
                }
                
                await supabase
                    .from('whatsapp_conversations')
                    .update({
                        unread_count: isFromMe ? (conv.unread_count || 0) : ((conv.unread_count || 0) + 1), 
                        last_message_at: new Date().toISOString(),
                        status: nextStatus,
                        contact_name: isGroup ? conv.contact_name : (pushName || conv.contact_name)
                    }).eq('id', conversationId);
            }
        }

        // 2. Inserir a mensagem
        if (conversationId) {
            await supabase.from('whatsapp_messages').insert({
                company_id: companyId,
                conversation_id: conversationId,
                message_text: text,
                is_from_customer: !isFromMe,
                whatsapp_message_id: msgId,
                media_url: mediaUrl,
                media_type: mediaType,
                created_at: message.messageTimestamp ? new Date(message.messageTimestamp * 1000).toISOString() : new Date().toISOString()
            });

            if (!isHistorical && !isFromMe) {
                // Chatbot se necessário
                runChatbot(message, conv || { id: conversationId, contact_phone: fromPhone }, companyId, connectionId);
            }
        }
    } catch (err) {
        console.error('[MSG] Erro fatal:', err.message);
    }
}

app.post('/sync-contacts/:companyId/:connectionId', async (req, res) => {
    const { companyId, connectionId } = req.params;
    try {
        const instanceName = `conn_${connectionId}`;
        console.log(`[HTTP] Iniciando sync manual para ${instanceName}...`);
        syncEvolutionData(instanceName, companyId, connectionId);
        res.json({ success: true, message: 'Sincronização iniciada com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/webhook/evolution/:companyId/:connectionId', async (req, res) => {
    // Responde 200 rápido para a Evolution não travar
    res.status(200).json({ received: true });

    const { companyId, connectionId } = req.params;
    const body = req.body;

    // A Evolution API pode enviar o evento em diferentes formatos de campo
    const event = (body.event || body.type || body.status || '').toLowerCase();
    const data = body.data || body;
    const instance = body.instance || body.instanceName || connectionId;

    console.log(`[WEBHOOK] ===== Evento recebido: "${event}" | Instância: ${instance} | Empresa: ${companyId} =====`);
    console.log(`[WEBHOOK RAW]`, JSON.stringify(body, null, 2).substring(0, 1000)); // Limita para não sobrecarregar os logs

    if (!event) {
        console.log(`[WEBHOOK] Payload sem campo 'event'. Body keys: ${Object.keys(body).join(', ')}`);
        return;
    }

    // ----- QR CODE ATUALIZADO -----
    if (event === 'qrcode.updated' || event === 'qrcode_updated' || event === 'qr') {
        const qrBase64 = data?.qrcode?.base64 || data?.base64 || data?.qr;
        if (qrBase64) {
            console.log(`[WEBHOOK] QR Code recebido, salvando no banco...`);
            await supabase.from('whatsapp_settings').update({ qr_code: qrBase64, is_connected: false }).eq('id', connectionId);
        } else {
            console.warn(`[WEBHOOK] Evento QR sem base64. Data:`, JSON.stringify(data));
        }
    }

    // ----- STATUS DE CONEXÃO -----
    if (event === 'connection.update' || event === 'connection_update') {
        const state = (data?.state || data?.status || '').toLowerCase();
        console.log(`[WEBHOOK] Status de Conexão: "${state}"`);

        if (state === 'open' || state === 'connected') {
            await supabase.from('whatsapp_settings').update({ is_connected: true, qr_code: null }).eq('id', connectionId);
            // Disparar sincronização em background
            const instanceName = `conn_${connectionId}`;
            syncEvolutionData(instanceName, companyId, connectionId);
        } else if (state === 'close' || state === 'disconnected' || state === 'refused') {
            await supabase.from('whatsapp_settings').update({ is_connected: false }).eq('id', connectionId);
        }
    }

    // ----- MENSAGEM RECEBIDA OU ENVIADA -----
    // Cobre event names de v1 e v2: messages.upsert, MESSAGES_UPSERT, messages_upsert, send.message, SEND_MESSAGE
    const isMessageEvent = ['messages.upsert','messages_upsert','messages.update','send.message','send_message','message'].includes(event);
    if (isMessageEvent) {
        // O payload pode vir como { messages: [msg] } ou { message: msg } ou direto
        let messages = [];
        if (data?.messages && Array.isArray(data.messages)) {
            messages = data.messages;
        } else if (data?.message) {
            messages = [data];
        } else if (data?.key) {
            messages = [data];
        } else if (Array.isArray(data)) {
            messages = data;
        }

        console.log(`[WEBHOOK] ${messages.length} mensagem(ns) para processar.`);
        for (const message of messages) {
            if (!message || !message.key) {
                console.log(`[WEBHOOK] Mensagem sem 'key', ignorando. Dados:`, JSON.stringify(message).substring(0, 200));
                continue;
            }
            await processInboundMessage(message, companyId, connectionId);
        }
    }
});


app.listen(port, () => {
  console.log(`🚀 Servidor WhatsPanda (Evolution Proxy) rodando na porta ${port}`);
});
