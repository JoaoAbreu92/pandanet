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
const pushService = require('./utils/pushService');

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

// Global debug logs in memory
global.debugLogs = [];
function addDebugLog(type, message, details = null) {
    const timestamp = new Date().toISOString();
    global.debugLogs.unshift({ timestamp, type, message, details });
    if (global.debugLogs.length > 200) {
        global.debugLogs.pop();
    }
    console.log(`[DEBUG_LOG] [${type}] ${message}`, details ? JSON.stringify(details).substring(0, 300) : '');
}

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

// Suporte robusto para timestamp protobuf Long do webhook
function parseMessageTimestamp(ts) {
    if (!ts) return new Date().toISOString();
    if (typeof ts === 'object' && ts !== null) {
        const val = typeof ts.low === 'number' ? ts.low : (typeof ts.low === 'string' ? parseInt(ts.low) : null);
        if (val !== null && !isNaN(val)) {
            return new Date(val * 1000).toISOString();
        }
    }
    const num = Number(ts);
    if (!isNaN(num)) {
        return new Date(num * 1000).toISOString();
    }
    return new Date().toISOString();
}

const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey ? supabaseKey.trim() : '');

// --- CONFIGURAÇÃO DO REALTIME PARA NOTIFICAÇÕES PUSH EM SEGUNDO PLANO ---
function setupPushNotificationsListener() {
    console.log('[FCM] Inicializando ouvintes do Supabase Realtime para notificações...');

    // 1. Ouvinte para a tabela: notifications
    supabase
        .channel('fcm-notifications-insert')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications'
        }, async (payload) => {
            try {
                const notif = payload.new;
                if (!notif || !notif.user_id) return;

                console.log(`[FCM] Nova notificação detectada no banco para o usuário: ${notif.user_id}`);

                // Buscar token push do usuário destinatário
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('push_token')
                    .eq('id', notif.user_id)
                    .single();

                if (error || !profile?.push_token) {
                    if (error) console.error('[FCM] Erro ao buscar token push do perfil:', error.message);
                    return;
                }

                await pushService.sendPushNotification(
                    profile.push_token,
                    notif.title || 'PandaNet',
                    notif.description || '',
                    {
                        type: notif.type || 'notification',
                        link: notif.link || ''
                    }
                );
            } catch (err) {
                console.error('[FCM] Erro crítico no ouvinte de notifications:', err.message);
            }
        })
        .subscribe((status) => {
            console.log(`[FCM] Status do canal de notifications: ${status}`);
        });

    // 2. Ouvinte para a tabela: messages (Chat Interno)
    supabase
        .channel('fcm-messages-insert')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages'
        }, async (payload) => {
            try {
                const msg = payload.new;
                if (!msg || !msg.conversation_id || !msg.sender_id) return;

                console.log(`[FCM] Nova mensagem de chat na conversa: ${msg.conversation_id}`);

                // 2.1 Buscar remetente
                const { data: senderProf } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', msg.sender_id)
                    .maybeSingle();

                const senderName = senderProf?.full_name || 'Alguém';

                // 2.2 Buscar outros participantes da conversa
                const { data: participants, error: pError } = await supabase
                    .from('conversation_participants')
                    .select('user_id')
                    .eq('conversation_id', msg.conversation_id)
                    .neq('user_id', msg.sender_id);

                if (pError || !participants || participants.length === 0) return;

                for (const p of participants) {
                    // Buscar o token push de cada participante
                    const { data: prof } = await supabase
                        .from('profiles')
                        .select('push_token')
                        .eq('id', p.user_id)
                        .maybeSingle();

                    if (prof?.push_token) {
                        await pushService.sendPushNotification(
                            prof.push_token,
                            senderName,
                            msg.text || (msg.file_url ? 'Enviou um arquivo' : 'Nova mensagem'),
                            {
                                type: 'chat',
                                conversationId: msg.conversation_id,
                                link: `/chat/${msg.conversation_id}`
                            }
                        );
                    }
                }
            } catch (err) {
                console.error('[FCM] Erro no ouvinte de messages:', err.message);
            }
        })
        .subscribe((status) => {
            console.log(`[FCM] Status do canal de messages: ${status}`);
        });

    // 3. Ouvinte para a tabela: whatsapp_messages (WhatsPanda)
    supabase
        .channel('fcm-whatsapp-messages-insert')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'whatsapp_messages'
        }, async (payload) => {
            try {
                const newMsg = payload.new;
                if (!newMsg || !newMsg.is_from_customer || !newMsg.conversation_id) return;

                console.log(`[FCM] Nova mensagem de cliente recebida no WhatsPanda. Conversa: ${newMsg.conversation_id}`);

                // 3.1 Buscar informações da conversa (atendente responsável e nome do cliente)
                const { data: convInfo } = await supabase
                    .from('whatsapp_conversations')
                    .select('contact_name, assigned_to, company_id')
                    .eq('id', newMsg.conversation_id)
                    .maybeSingle();

                const contactName = convInfo?.contact_name || 'Cliente';
                const bodyText = newMsg.message_text || (newMsg.media_url ? 'Enviou uma mídia' : 'Nova mensagem do WhatsApp');

                if (convInfo?.assigned_to) {
                    // Se estiver atribuído a um atendente específico, notifica ele
                    const { data: agent } = await supabase
                        .from('profiles')
                        .select('push_token')
                        .eq('id', convInfo.assigned_to)
                        .maybeSingle();

                    if (agent?.push_token) {
                        await pushService.sendPushNotification(
                            agent.push_token,
                            `WhatsPanda: ${contactName}`,
                            bodyText,
                            {
                                type: 'whatsapp',
                                conversationId: newMsg.conversation_id,
                                link: `/whatspanda`
                            }
                        );
                    }
                } else if (convInfo?.company_id) {
                    // Se não estiver atribuído, notifica administradores da mesma empresa
                    const { data: admins } = await supabase
                        .from('profiles')
                        .select('push_token')
                        .eq('company_id', convInfo.company_id)
                        .or('role.eq.Super Admin,is_admin.eq.true,is_company_admin.eq.true');

                    if (admins && admins.length > 0) {
                        for (const adminProf of admins) {
                            if (adminProf.push_token) {
                                await pushService.sendPushNotification(
                                    adminProf.push_token,
                                    `WhatsPanda (Não Atribuído): ${contactName}`,
                                    bodyText,
                                    {
                                        type: 'whatsapp',
                                        conversationId: newMsg.conversation_id,
                                        link: `/whatspanda`
                                    }
                                );
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('[FCM] Erro no ouvinte de whatsapp_messages:', err.message);
            }
        })
        .subscribe((status) => {
            console.log(`[FCM] Status do canal de whatsapp_messages: ${status}`);
        });
}

// Inicializa os ouvintes
setupPushNotificationsListener();

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

        let phoneNumber;
        if (conv.is_group) {
            phoneNumber = conv.contact_phone.includes('@g.us') ? conv.contact_phone : `${conv.contact_phone}@g.us`;
        } else {
            phoneNumber = (conv.contact_phone || '').replace(/\D/g, '');
            
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
            // Converter a URL pública em Base64 bruto (para contornar NAT Loopback do Docker VPS)
            let base64Data;
            try {
                base64Data = await getBase64FromUrl(mediaUrl);
            } catch (base64Err) {
                console.error(`[SEND API] Falha ao converter mídia para base64:`, base64Err.message);
                return res.status(500).json({ error: `Falha ao processar arquivo para envio: ${base64Err.message}` });
            }

            // Se for figurinha MAS for GIF, melhor tratar como mídia imagem (Evolution converte melhor no celular)
            const isGif = mediaUrl.toLowerCase().split('?')[0].endsWith('.gif');
            const isSticker = mediaType === 'sticker' && !isGif;
            const isAudio = mediaType && (mediaType.startsWith('audio') || mediaType === 'audio');
            
            let endpoint = 'sendMedia';
            if (isSticker) {
                endpoint = 'sendSticker';
            } else if (isAudio) {
                endpoint = 'sendWhatsAppAudio';
            }
            
            const cleanUrl = mediaUrl.split('?')[0];
            const fileName = cleanUrl.split('/').pop() || 'file';
            
            const body = isSticker ? {
                number: phoneNumber,
                stickerMessage: {
                    sticker: base64Data
                }
            } : isAudio ? {
                number: phoneNumber,
                audioMessage: {
                    audio: base64Data,
                    ptt: true
                },
                options: {
                    encoding: true
                }
            } : {
                number: phoneNumber,
                mediaMessage: {
                    mediatype: isGif ? 'image' : getEvoMediaType(mediaType),
                    mimetype: mediaType,
                    media: base64Data,
                    fileName: fileName,
                    caption: message || ''
                }
            };
            console.log(`[SEND API] Enviando para Evolution: endpoint=${endpoint} | body length=`, JSON.stringify(body).length);

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 120000); // 120s timeout

            let sendReq;
            try {
                sendReq = await fetch(`${evoUrl}/message/${endpoint}/${instanceName}`, {
                    method: 'POST',
                    headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: controller.signal
                });
            } catch (fetchErr) {
                clearTimeout(timeout);
                console.error(`[SEND API] Erro de rede/timeout ao enviar mídia:`, fetchErr.message);
                return res.status(504).json({ error: `Timeout ou erro de rede ao enviar mídia para WhatsApp: ${fetchErr.message}` });
            }
            clearTimeout(timeout);
            
            try { sendRes = await sendReq.json(); } catch(e) { sendRes = {}; }
            console.log(`[SEND API] Resposta ${endpoint} (${sendReq.status}):`, JSON.stringify(sendRes).substring(0, 500));
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



/**
 * Helper to fetch a file and return its content as a raw Base64 string.
 * It rewrites public/external URLs to internal Docker URLs if needed to avoid loopback issues.
 */
async function getBase64FromUrl(url) {
    try {
        console.log(`[BASE64-FETCH] Original URL: ${url}`);
        let targetUrl = url;
        
        if (supabaseUrl) {
            const storageIndex = url.indexOf('/storage/v1/object/public/');
            if (storageIndex !== -1) {
                const storagePath = url.substring(storageIndex);
                const base = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;
                targetUrl = `${base}${storagePath}`;
                console.log(`[BASE64-FETCH] Rewrote URL to internal Supabase: ${targetUrl}`);
            }
        }

        const resp = await fetch(targetUrl);
        if (!resp.ok) {
            throw new Error(`Failed to fetch media from ${targetUrl}: ${resp.status} ${resp.statusText}`);
        }
        
        const buffer = await resp.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        console.log(`[BASE64-FETCH] Successfully fetched and converted to Base64 (length: ${base64.length})`);
        return base64;
    } catch (err) {
        console.error(`[BASE64-FETCH] Error fetching URL ${url}:`, err.message);
        try {
            console.log(`[BASE64-FETCH] Attempting fallback fetch of original URL: ${url}`);
            const resp = await fetch(url);
            if (resp.ok) {
                const buffer = await resp.arrayBuffer();
                return Buffer.from(buffer).toString('base64');
            }
        } catch (fallbackErr) {
            console.error(`[BASE64-FETCH] Fallback fetch also failed:`, fallbackErr.message);
        }
        throw err;
    }
}

async function updateInstanceSettings(instanceName) {
    try {
        console.log(`[SETTINGS] Configurando instância ${instanceName}...`);
        const resp = await fetch(`${evoUrl}/settings/set/${instanceName}`, {
            method: 'POST',
            headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reject_call: false,
                msg_call: "",
                groups_ignore: false,
                always_online: true,
                read_messages: false,
                read_status: false,
                sync_full_history: true,
                wavoipToken: ""
            })
        });
        if (resp.ok) {
            console.log(`[SETTINGS] Configurações de ${instanceName} aplicadas com sucesso.`);
        } else {
            const errText = await resp.text();
            console.error(`[SETTINGS] Erro ao aplicar configurações em ${instanceName} (${resp.status}): ${errText}`);
        }
    } catch (e) {
        console.error(`[SETTINGS] Erro ao aplicar configurações em ${instanceName}:`, e.message);
    }
}

// API: Debug Logs em Memória
router.get('/debug-logs', (req, res) => {
    res.json(global.debugLogs);
});

// API: Reparar Webhooks
router.post('/repair-webhooks/:companyId/:connectionId', authMiddleware, async (req, res) => {
    const { companyId, connectionId } = req.params;
    const instanceName = `conn_${connectionId}`;
    const webhookUrl = `${backendWebhookBaseUrl}/webhook/evolution/${companyId}/${connectionId}`;

    console.log(`[REPAIR] Atualizando webhook e settings para ${instanceName} -> ${webhookUrl}`);

    try {
        // 1. Atualizar Webhook
        const repairReq = await fetch(`${evoUrl}/webhook/set/${instanceName}`, {
            method: 'POST',
            headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                enabled: true,
                url: webhookUrl,
                events: [
                    'QRCODE_UPDATED', 
                    'CONNECTION_UPDATE', 
                    'MESSAGES_UPSERT', 
                    'MESSAGES_UPDATE', 
                    'MESSAGES_DELETE',
                    'SEND_MESSAGE',
                    'CALL'
                ]
            })
        });

        const repairRes = await repairReq.json();
        
        // 2. Atualizar Settings da Instância
        await updateInstanceSettings(instanceName);

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
        console.log(`[SYNC] Iniciando sincronização total para ${instanceName}...`);
        
        // Garantir settings corretos (ex: sync_full_history)
        await updateInstanceSettings(instanceName);
        
        const { data: channelSettings } = await supabase
            .from('whatsapp_settings')
            .select('phone_number')
            .eq('id', connectionId)
            .maybeSingle();
        const channelPhone = channelSettings?.phone_number ? channelSettings.phone_number.replace(/\D/g, '') : '';
        
        const processedJids = new Set();
        const contactsToUpsert = [];
        
        if (evoUrl.startsWith('https')) {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        }

        // 1. Buscar Contatos Pessoais
        const headers = { 
            'apikey': evoKey, 
            'Content-Type': 'application/json',
            'instance': instanceName // Algumas versões v1 exigem este header
        };

        try {
            addDebugLog('SYNC_START', `Buscando contatos pessoais para ${instanceName}`);
            const resp = await fetch(`${evoUrl}/chat/findContacts/${instanceName}`, {
                method: 'POST',
                headers,
                body: JSON.stringify({})
            });
            if (resp.ok) {
                const raw = await resp.json();
                const list = Array.isArray(raw) ? raw : (raw.contacts || raw.data || []);
                addDebugLog('SYNC_CONTACTS_RAW', `Encontrados ${list.length} contatos pessoais.`);
                for (const c of list) {
                    const jid = c.remoteJid || c.jid || c.id || '';
                    if (!jid || jid.includes('@g.us') || jid.includes('@newsletter') || jid.includes('@broadcast')) continue;
                    const phone = jid.split('@')[0];
                    
                    // Ignorar se for o próprio telefone da conexão
                    const cleanPhone = phone.replace(/\D/g, '');
                    if (channelPhone && (cleanPhone === channelPhone || cleanPhone.endsWith(channelPhone) || channelPhone.endsWith(cleanPhone))) {
                        continue;
                    }
                    
                    if (!processedJids.has(phone)) {
                        processedJids.add(phone);
                        contactsToUpsert.push({ 
                            company_id: companyId, 
                            phone, 
                            name: c.pushName || c.pushname || c.verifiedName || c.name || c.notify || formatPhoneDisplay(phone), 
                            is_group: false,
                            updated_at: new Date().toISOString() 
                        });
                    }
                }
            } else {
                const errText = await resp.text();
                addDebugLog('SYNC_CONTACTS_ERR', `Erro na resposta findContacts: ${resp.status} - ${errText}`);
            }
        } catch(e) { 
            console.error(`[SYNC] Erro contatos:`, e.message); 
            addDebugLog('SYNC_CONTACTS_EXCEPTION', `Exceção em findContacts: ${e.message}`);
        }

        // 4. Buscar Histórico
        let activeChats = [];
        try {
            addDebugLog('SYNC_CHATS_START', `Buscando chats ativos para ${instanceName}`);
            const respC = await fetch(`${evoUrl}/chat/findChats/${instanceName}`, { 
                method: 'GET', 
                headers 
            });
            if (respC.ok) {
                const raw = await respC.json();
                activeChats = Array.isArray(raw) ? raw : (raw.chats || raw.data || []);
                addDebugLog('SYNC_CHATS_RAW', `Encontrados ${activeChats.length} chats ativos.`);
                
                // Extrair contatos também dos chats ativos para garantir que apareçam
                for (const chat of activeChats) {
                    const jid = chat.remoteJid || chat.jid || chat.id || '';
                    if (!jid || jid.includes('@g.us') || jid.includes('@broadcast') || jid.includes('@newsletter')) continue;
                    const phone = jid.split('@')[0];
                    
                    // Ignorar se for o próprio telefone da conexão
                    const cleanPhone = phone.replace(/\D/g, '');
                    if (channelPhone && (cleanPhone === channelPhone || cleanPhone.endsWith(channelPhone) || channelPhone.endsWith(cleanPhone))) {
                        continue;
                    }
                    
                    if (!processedJids.has(phone)) {
                        processedJids.add(phone);
                        contactsToUpsert.push({
                            company_id: companyId,
                            phone,
                            name: chat.pushName || chat.pushname || chat.name || chat.verifiedName || formatPhoneDisplay(phone),
                            is_group: false,
                            updated_at: new Date().toISOString()
                        });
                    }
                }
            } else {
                const errText = await respC.text();
                addDebugLog('SYNC_CHATS_ERR', `Erro na resposta findChats: ${respC.status} - ${errText}`);
            }
        } catch(e) { 
            console.error(`[SYNC] Erro findChats:`, e.message); 
            addDebugLog('SYNC_CHATS_EXCEPTION', `Exceção em findChats: ${e.message}`);
        }

        if (contactsToUpsert.length > 0) {
            console.log(`[SYNC] Upserting ${contactsToUpsert.length} contatos no Supabase...`);
            const chunks = [];
            for (let i = 0; i < contactsToUpsert.length; i += 500) chunks.push(contactsToUpsert.slice(i, i + 500));
            for (const chunk of chunks) {
                await supabase.from('whatsapp_contacts').upsert(chunk, { onConflict: 'company_id,phone', ignoreDuplicates: false });
            }
            await supabase.from('whatsapp_settings').update({ last_sync_error: `✅ Sincronização de contatos OK às ${new Date().toLocaleTimeString()}.` }).eq('id', connectionId);
        }

        // Sincronizar Grupos
        try {
            console.log(`[SYNC] Sincronizando grupos de ${activeChats.length} chats ativos...`);
            for (const chat of activeChats) {
                const jid = chat.remoteJid || chat.jid || chat.id || '';
                if (jid.includes('@g.us')) {
                    const phone = jid.split('@')[0];
                    
                    // Verificar se já existe a conversa no banco
                    const { data: convExists } = await supabase
                        .from('whatsapp_conversations')
                        .select('id')
                        .eq('company_id', companyId)
                        .eq('contact_phone', phone)
                        .maybeSingle();

                    if (!convExists) {
                        const groupInfo = await fetchGroupInfo(instanceName, jid);
                        const groupName = groupInfo?.subject || chat.name || chat.subject || 'Grupo (Sem Nome)';
                        
                        const { error: insertErr } = await supabase.from('whatsapp_conversations').insert({
                            company_id: companyId,
                            connection_id: connectionId,
                            contact_phone: phone,
                            contact_name: groupName,
                            is_group: true,
                            status: 'aberto',
                            unread_count: 0,
                            last_message_at: new Date().toISOString()
                        });
                        if (insertErr) {
                            console.error(`[SYNC] Erro ao importar grupo:`, insertErr.message);
                            addDebugLog('SYNC_GROUP_INSERT_ERR', `Erro ao importar grupo ${groupName}: ${insertErr.message}`);
                        } else {
                            console.log(`[SYNC] Grupo importado com sucesso: ${groupName} (${phone})`);
                        }
                    }
                }
            }

            // Sincronização adicional: buscar todos os grupos da conta no WhatsApp (mesmo inativos no chat recente)
            console.log(`[SYNC] Buscando todos os grupos de ${instanceName} via fetchAllGroups...`);
            const respG = await fetch(`${evoUrl}/group/fetchAllGroups/${instanceName}?getParticipants=false`, {
                method: 'GET',
                headers
            });
            if (respG.ok) {
                const textG = await respG.text();
                let allGroups = [];
                if (textG && textG.trim().length > 0) {
                    try {
                        const rawG = JSON.parse(textG);
                        allGroups = Array.isArray(rawG) ? rawG : (rawG.groups || rawG.data || []);
                    } catch (parseErr) {
                        console.error(`[SYNC] Erro ao fazer parse dos grupos:`, parseErr.message);
                        addDebugLog('SYNC_GROUPS_PARSE_ERR', `Erro ao fazer parse dos grupos: ${parseErr.message}`);
                    }
                } else {
                    console.log(`[SYNC] fetchAllGroups retornou corpo vazio para ${instanceName}`);
                    addDebugLog('SYNC_GROUPS_EMPTY', `fetchAllGroups retornou corpo vazio para ${instanceName}`);
                }
                console.log(`[SYNC] Encontrados ${allGroups.length} grupos no total.`);
                addDebugLog('SYNC_GROUPS_RAW', `Encontrados ${allGroups.length} grupos no total.`);

                for (const g of allGroups) {
                    const jid = g.id || g.jid || '';
                    if (!jid || !jid.includes('@g.us')) continue;
                    const phone = jid.split('@')[0];

                    const { data: convExists } = await supabase
                        .from('whatsapp_conversations')
                        .select('id')
                        .eq('company_id', companyId)
                        .eq('contact_phone', phone)
                        .maybeSingle();

                    if (!convExists) {
                        const groupName = g.subject || g.name || 'Grupo (Sem Nome)';
                        const { error: insertErr } = await supabase.from('whatsapp_conversations').insert({
                            company_id: companyId,
                            connection_id: connectionId,
                            contact_phone: phone,
                            contact_name: groupName,
                            is_group: true,
                            status: 'aberto',
                            unread_count: 0,
                            last_message_at: new Date().toISOString()
                        });
                        if (insertErr) {
                            console.error(`[SYNC] Erro ao importar grupo via fetchAllGroups:`, insertErr.message);
                            addDebugLog('SYNC_GROUP_FETCHALL_INSERT_ERR', `Erro ao importar grupo ${groupName}: ${insertErr.message}`);
                        } else {
                            console.log(`[SYNC] Grupo importado via fetchAllGroups: ${groupName} (${phone})`);
                        }
                    }
                }
            } else {
                const errText = await respG.text();
                addDebugLog('SYNC_GROUPS_ERR', `Erro na resposta fetchAllGroups: ${respG.status} - ${errText}`);
            }
        } catch (groupSyncErr) {
            console.error(`[SYNC] Erro ao sincronizar grupos:`, groupSyncErr.message);
            addDebugLog('SYNC_GROUPS_EXCEPTION', `Exceção em sincronizar grupos: ${groupSyncErr.message}`);
        }

        console.log(`[SYNC] Histórico para ${activeChats.length} chats ignorado por configuração (apenas novas mensagens geram atendimentos).`);
        console.log(`[SYNC] Concluído para ${instanceName}.`);
    } catch (err) {
        console.error(`[SYNC] Erro fatal:`, err.message);
        addDebugLog('SYNC_FATAL_ERR', `Erro fatal na sincronização: ${err.message}`);
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

/**
 * Baixa mídia da Evolution API (Base64)
 */
async function downloadEvolutionMedia(instanceName, message, mediatype) {
    let lastError = null;
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[MEDIA] [Tentativa ${attempt}] Baixando ${mediatype} da mensagem ${message.key.id}...`);
            
            const endpoint = 'getBase64FromMediaMessage';
            
            // Tentar extrair a mensagem "limpa" para a Evolution
            const cleanMessage = JSON.parse(JSON.stringify(message));
            const unwrap = (obj) => {
                if (obj.message?.ephemeralMessage) obj.message = obj.message.ephemeralMessage.message;
                if (obj.message?.viewOnceMessage) obj.message = obj.message.viewOnceMessage.message;
                if (obj.message?.viewOnceMessageV2) obj.message = obj.message.viewOnceMessageV2.message;
                if (obj.message?.documentWithCaptionMessage) obj.message = obj.message.documentWithCaptionMessage.message;
            };
            unwrap(cleanMessage);

            const resp = await fetch(`${evoUrl}/chat/${endpoint}/${instanceName}`, {
                method: 'POST',
                headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: cleanMessage
                })
            });

            if (!resp.ok) {
                const errLog = await resp.text();
                lastError = `Status ${resp.status}: ${errLog}`;
                console.error(`[MEDIA] Erro no download (Tentativa ${attempt}):`, lastError);
                if (resp.status === 404 || resp.status === 410) {
                    console.warn(`[MEDIA] Mídia expirou na Evolution (404/410). Abortando tentativas.`);
                    break; 
                }
                continue;
            }

            const data = await resp.json();
            const base64 = typeof data === 'string' ? data : (data.base64 || data.data || null);
            
            if (base64 && base64.length > 50) {
                console.log(`[MEDIA] Base64 extraído com sucesso (Tamanho: ${base64.length})`);
                return base64;
            } else {
                console.warn(`[MEDIA] Base64 veio vazio ou pequeno demais (Atentativa ${attempt}).`);
                lastError = "Base64 vazio";
            }
        } catch (e) {
            lastError = e.message;
            console.error(`[MEDIA] Erro no download (Tentativa ${attempt}):`, e.message);
        }
        
        if (attempt < maxRetries) await new Promise(r => setTimeout(r, 1000));
    }

    console.error(`[MEDIA] FALHA FINAL após ${maxRetries} tentativas:`, lastError);
    return null;
}

/**
 * Sobe Buffer/Base64 para o Supabase Storage
 */
async function uploadMediaToSupabase(base64, mediatype, companyId, mimeType = null, fileName = null) {
    try {
        if (!base64) return null;
        
        let ext = 'bin';
        let contentType = mimeType || 'application/octet-stream';
        
        if (mediatype === 'image') { ext = 'jpg'; contentType = mimeType || 'image/jpeg'; }
        else if (mediatype === 'audio') { ext = 'ogg'; contentType = mimeType || 'audio/ogg'; }
        else if (mediatype === 'video' || mediatype === 'gif') { ext = 'mp4'; contentType = mimeType || 'video/mp4'; }
        else if (mediatype === 'sticker') { ext = 'webp'; contentType = mimeType || 'image/webp'; }
        else if (fileName) {
            const parts = fileName.split('.');
            if (parts.length > 1) ext = parts.pop();
        }

        const safeFileName = fileName ? fileName.replace(/[^a-zA-Z0-9.-]/g, '_') : `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const finalName = fileName ? `${Date.now()}_${safeFileName}` : safeFileName;
        const filePath = `received/${companyId}/${finalName}`;
        console.log(`[STORAGE] Fazendo upload para: ${filePath} (MIME: ${contentType})`);
        
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
        const buffer = Buffer.from(base64Data, 'base64');

        const { data, error } = await supabase.storage
            .from('chat-media')
            .upload(filePath, buffer, { contentType, upsert: true });

        if (error) {
            console.error(`[STORAGE] Erro no upload:`, error.message);
            return null;
        }

        let { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(filePath);
        
        // CORREÇÃO: Forçar URL Pública
        const publicBase = process.env.PUBLIC_SUPABASE_URL || 'http://77.37.43.60:8000'; 
        if (publicUrl.includes('supabase-kong:8000')) {
            publicUrl = publicUrl.replace('http://supabase-kong:8000', publicBase);
        }
        console.log(`[STORAGE] Upload concluído! URL: ${publicUrl}`);
        return publicUrl;
    } catch (e) {
        console.error(`[STORAGE] Erro fatal no upload:`, e.message);
        return null;
    }
}

async function fetchGroupInfo(instanceName, groupJid) {
    try {
        console.log(`[EVOLUTION] Buscando info do grupo ${groupJid} na instância ${instanceName}...`);
        const resp = await fetch(`${evoUrl}/group/findGroupInfos/${instanceName}?groupJid=${groupJid}`, {
            method: 'GET',
            headers: { 'apikey': evoKey }
        });
        if (resp.ok) {
            const data = await resp.json();
            return data;
        } else {
            const errText = await resp.text();
            console.error(`[EVO-GROUP-INFO] Erro ${resp.status}: ${errText}`);
        }
    } catch (err) {
        console.error(`[EVO-GROUP-INFO] Exceção ao buscar grupo ${groupJid}:`, err.message);
    }
    return null;
}

const activeCreations = new Map(); // key: `${companyId}_${fromPhone}` -> Promise<conversationId>

async function processInboundMessage(message, companyId, connectionId, isHistorical = false) {
    try {
        const isFromMe = message.key?.fromMe;
        let remoteJid = message.key?.remoteJid || '';
        
        // Ignorar broadcasts mas permitir grupos e @lid
        if (!remoteJid || remoteJid.includes('@broadcast') || remoteJid.includes('@newsletter')) return;
        const isGroup = remoteJid.includes('@g.us');
        
        // extrair telefone real
        let fromPhone;
        if (remoteJid.includes('@lid')) {
            const senderPn = message.key?.senderPn || message.senderPn || '';
            if (senderPn) {
                fromPhone = senderPn.split('@')[0];
            } else {
                console.log(`[MSG] JID @lid sem senderPn. Ignorando.`);
                addDebugLog('MSG_LID_ERR', `JID @lid sem senderPn para msg ${message.key?.id}`);
                return;
            }
        } else {
            fromPhone = remoteJid.split('@')[0];
        }

        if (!fromPhone) return;

        // Buscar dados do canal para saber o próprio número e ignorá-lo
        const { data: channelSettings } = await supabase
            .from('whatsapp_settings')
            .select('phone_number')
            .eq('id', connectionId)
            .maybeSingle();
        
        const channelPhone = channelSettings?.phone_number ? channelSettings.phone_number.replace(/\D/g, '') : '';
        const cleanFromPhone = fromPhone.replace(/\D/g, '');
        if (channelPhone && (cleanFromPhone === channelPhone || cleanFromPhone.endsWith(channelPhone) || channelPhone.endsWith(cleanFromPhone))) {
            console.log(`[MSG] Ignorando mensagem do próprio número da conexão: ${fromPhone}`);
            return;
        }

        console.log(`[MSG] Processando mensagem ${message.key?.id} de ${remoteJid}${isHistorical ? ' (Histórico)' : ''}`);
        addDebugLog('MSG_PROCESS', `Processando mensagem: ${message.key?.id} | De: ${remoteJid} | fromMe: ${isFromMe} | Histórico: ${isHistorical}`);

        const msgId = message.key?.id;
        const pushName = message.pushName || message.pushname || message.contact?.name || message.verifiedName || null;

        // Auto-criar contato para indivíduos (não grupos)
        if (fromPhone && !isGroup) {
            // Se for enviado por nós (fromMe: true), o pushName no webhook é o nosso perfil.
            // Portanto, usamos apenas o número formatado como nome do contato para evitar salvar o nosso nome nele.
            // Se for enviado pelo cliente, usamos o pushName do cliente.
            const contactName = isFromMe ? formatPhoneDisplay(fromPhone) : (pushName || formatPhoneDisplay(fromPhone));
            
            if (!isFromMe) {
                // Upsert para garantir atualização do pushName do cliente se ele enviar mensagem
                await supabase
                    .from('whatsapp_contacts')
                    .upsert(
                        { company_id: companyId, phone: fromPhone, name: contactName, updated_at: new Date().toISOString() },
                        { onConflict: 'company_id,phone', ignoreDuplicates: false }
                    );
            } else {
                // Se for fromMe, verifica se já existe. Se não existir, insere.
                const { data: contactExists } = await supabase
                    .from('whatsapp_contacts')
                    .select('id')
                    .eq('company_id', companyId)
                    .eq('phone', fromPhone)
                    .maybeSingle();
                
                if (!contactExists) {
                    addDebugLog('CONTACT_AUTO_CREATE', `Criando contato de destino para mensagem enviada do celular: ${fromPhone}`);
                    await supabase
                        .from('whatsapp_contacts')
                        .insert({
                            company_id: companyId,
                            phone: fromPhone,
                            name: contactName,
                            updated_at: new Date().toISOString()
                        });
                }
            }
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
                addDebugLog('MSG_BLOCKED', `Contato ${fromPhone} está bloqueado.`);
                return;
            }
        }

        // Verificar duplicata
        const { data: exists } = await supabase
            .from('whatsapp_messages')
            .select('id')
            .eq('whatsapp_message_id', msgId)
            .maybeSingle();
        
        if (exists) {
            addDebugLog('MSG_DUPLICATE', `Mensagem duplicada, ignorando: ${msgId}`);
            return;
        }

        // --- EXTRAÇÃO ROBUSTA DE CONTEÚDO ---
        // Auxiliar para extrair a mensagem real de wrappers (ephemeral, viewOnce, etc)
        const getRealMessage = (m) => {
            if (!m) return {};
            if (m.ephemeralMessage) return getRealMessage(m.ephemeralMessage.message);
            if (m.viewOnceMessage) return getRealMessage(m.viewOnceMessage.message);
            if (m.viewOnceMessageV2) return getRealMessage(m.viewOnceMessageV2.message);
            if (m.documentWithCaptionMessage) return getRealMessage(m.documentWithCaptionMessage.message);
            return m;
        };

        const m = getRealMessage(message.message || {});
        
        // Extrair texto de várias fontes possíveis
        let text = m.conversation || 
                   m.extendedTextMessage?.text || 
                   m.imageMessage?.caption || 
                   m.videoMessage?.caption || 
                   m.documentMessage?.caption ||
            message.text || message?.message?.text || "";

        let mediaUrl = null;
        let mediaType = null;
        let mimeType = null;
        let fileName = null;
        const mediaMsg = m.imageMessage || m.audioMessage || m.videoMessage || m.documentMessage || m.stickerMessage;
        
        if (mediaMsg) {
            mimeType = mediaMsg.mimetype || null;
            fileName = mediaMsg.fileName || mediaMsg.title || null;

            mediaType = m.imageMessage ? 'image' : 
                        m.audioMessage ? 'audio' : 
                        (m.videoMessage ? (m.videoMessage.gifPlayback ? 'gif' : 'video') : 
                        (m.stickerMessage ? 'sticker' : 'document'));

            // Enhance mediaType detection based on mimeType for documents
            if (mediaType === 'document' && mimeType) {
                if (mimeType.includes('image/')) mediaType = 'image';
                else if (mimeType.includes('audio/')) mediaType = 'audio';
                else if (mimeType.includes('video/')) mediaType = 'video';
            }
            
            if (!text) text = `[Mídia: ${mediaType}]`;
            
            console.log(`[MEDIA] Mídia detectada: ${mediaType} na mensagem ${msgId}`);
            
            // DOWNLOAD E UPLOAD DE MÍDIA
            const instanceName = `conn_${connectionId}`;
            try {
                const base64 = await downloadEvolutionMedia(instanceName, message, mediaType);
                if (base64) {
                    mediaUrl = await uploadMediaToSupabase(base64, mediaType, companyId, mimeType, fileName);
                    if (mediaUrl) {
                        console.log(`[MEDIA] Sucesso! URL salva: ${mediaUrl}`);
                    } else {
                        console.error(`[MEDIA] Falha no upload para o Supabase.`);
                    }
                } else {
                    console.error(`[MEDIA] Falha no download da Evolution API.`);
                }
            } catch (mediaErr) {
                console.error(`[MEDIA] Erro catastrófico no processamento de mídia:`, mediaErr.message);
            }
        }

        if (!text && !mediaMsg) return;

        // 1. Localizar ou Criar Conversa (Evitando condições de corrida concorrente)
        const creationKey = `${companyId}_${fromPhone}`;
        let conv;
        let conversationId;
        let isNewConversation = false;

        if (activeCreations.has(creationKey)) {
            conversationId = await activeCreations.get(creationKey);
            const { data: existingConv } = await supabase
                .from('whatsapp_conversations')
                .select('*')
                .eq('id', conversationId)
                .single();
            conv = existingConv;
        } else {
            const creationPromise = (async () => {
                let { data: existingList, error: findErr } = await supabase
                    .from('whatsapp_conversations')
                    .select('*')
                    .eq('company_id', companyId)
                    .eq('contact_phone', fromPhone)
                    .order('created_at', { ascending: true });

                if (findErr) {
                    console.error('[MSG] Erro ao buscar conversas existentes:', findErr.message);
                }

                const existing = (existingList && existingList.length > 0) ? existingList[0] : null;

                if (existing) {
                    return existing.id;
                }

                isNewConversation = true;
                const initialStatus = 'aberto';
                
                // Resolver nome amigável do contato/grupo
                let resolvedName = null;
                if (isGroup) {
                    const instanceName = `conn_${connectionId}`;
                    const groupInfo = await fetchGroupInfo(instanceName, remoteJid);
                    resolvedName = groupInfo?.subject || message?.subject || 'Grupo (Sem Nome)';
                } else {
                    const { data: dbContact } = await supabase
                        .from('whatsapp_contacts')
                        .select('name')
                        .eq('company_id', companyId)
                        .eq('phone', fromPhone)
                        .maybeSingle();
                    
                    if (dbContact && dbContact.name && !/^\d+$/.test(dbContact.name)) {
                        resolvedName = dbContact.name;
                    } else if (pushName && !/^\d+$/.test(pushName)) {
                        resolvedName = pushName;
                    } else {
                        resolvedName = formatPhoneDisplay(fromPhone);
                    }
                }

                const { data: newConv, error: createErr } = await supabase
                    .from('whatsapp_conversations')
                    .insert({
                        company_id: companyId,
                        contact_phone: fromPhone,
                        contact_name: resolvedName,
                        status: initialStatus,
                        unread_count: isHistorical ? 0 : 1,
                        connection_id: connectionId,
                        is_group: isGroup,
                        last_message_at: new Date().toISOString()
                    }).select().single();
                
                if (createErr) throw createErr;
                return newConv.id;
            })();

            activeCreations.set(creationKey, creationPromise);
            try {
                conversationId = await creationPromise;
                const { data: loadedConv } = await supabase
                    .from('whatsapp_conversations')
                    .select('*')
                    .eq('id', conversationId)
                    .single();
                conv = loadedConv;
            } finally {
                activeCreations.delete(creationKey);
            }
        }

        // Se a conversa já existia antes desta mensagem, atualiza contatos/status
        if (conv && !isNewConversation) {
            if (!isHistorical) {
                // Reabrir se estiver fechada
                let nextStatus = conv.status;
                if (conv.status === 'fechado') {
                    nextStatus = 'aberto';
                }
                
                // Tentar obter um nome melhor se o atual for apenas o número bruto ou sem nome
                let resolvedName = conv.contact_name;
                if (isGroup) {
                    if (!resolvedName || resolvedName === 'Grupo (Sem Nome)' || /^\d+$/.test(resolvedName)) {
                        const instanceName = `conn_${connectionId}`;
                        const groupInfo = await fetchGroupInfo(instanceName, remoteJid);
                        if (groupInfo?.subject) {
                            resolvedName = groupInfo.subject;
                        }
                    }
                } else {
                    if (!resolvedName || /^\d+$/.test(resolvedName) || resolvedName.startsWith('+55')) {
                        const { data: dbContact } = await supabase
                            .from('whatsapp_contacts')
                            .select('name')
                            .eq('company_id', companyId)
                            .eq('phone', fromPhone)
                            .maybeSingle();
                        
                        if (dbContact && dbContact.name && !/^\d+$/.test(dbContact.name)) {
                            resolvedName = dbContact.name;
                        } else if (pushName && !/^\d+$/.test(pushName)) {
                            resolvedName = pushName;
                        } else if (!resolvedName) {
                            resolvedName = formatPhoneDisplay(fromPhone);
                        }
                    }
                }
                
                await supabase
                    .from('whatsapp_conversations')
                    .update({
                        unread_count: isFromMe ? (conv.unread_count || 0) : ((conv.unread_count || 0) + 1), 
                        last_message_at: new Date().toISOString(),
                        status: nextStatus,
                        contact_name: resolvedName
                    }).eq('id', conversationId);
            }
        }

        let senderPhone = null;
        let senderName = null;
        if (isGroup) {
            const participantJid = message.key?.participant || message.participant || '';
            if (participantJid) {
                senderPhone = participantJid.split('@')[0];
            }
            senderName = pushName;
        }

        // 2. Inserir a mensagem
        if (conversationId) {
            const { error: insertErr } = await supabase.from('whatsapp_messages').insert({
                company_id: companyId,
                conversation_id: conversationId,
                message_text: text,
                is_from_customer: !isFromMe,
                whatsapp_message_id: msgId,
                media_url: mediaUrl,
                media_type: mediaType,
                sender_phone: senderPhone,
                sender_name: senderName,
                created_at: parseMessageTimestamp(message.messageTimestamp)
            });

            if (insertErr) {
                addDebugLog('MSG_INSERT_ERR', `Erro ao inserir mensagem ${msgId} na conv ${conversationId}: ${insertErr.message}`, insertErr);
                throw insertErr;
            } else {
                addDebugLog('MSG_INSERT_OK', `Mensagem ${msgId} salva com sucesso na conv ${conversationId}`);
            }

            if (!isHistorical && !isFromMe && !isGroup) {
                // Chatbot se necessário (apenas para privados, não grupos)
                runChatbot(message, conv || { id: conversationId, contact_phone: fromPhone }, companyId, connectionId);
            }
        }
    } catch (err) {
        console.error('[MSG] Erro fatal:', err.message);
        addDebugLog('MSG_FATAL_ERR', `Erro fatal processando mensagem: ${err.message}`, err);
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
    addDebugLog('WEBHOOK_EVENT', `Evento: ${event} | Instância: ${instance} | Empresa: ${companyId}`, body);

    if (!event) {
        console.log(`[WEBHOOK] Payload sem campo 'event'. Body keys: ${Object.keys(body).join(', ')}`);
        addDebugLog('WEBHOOK_NO_EVENT', `Payload recebido sem evento. Keys: ${Object.keys(body).join(', ')}`);
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
