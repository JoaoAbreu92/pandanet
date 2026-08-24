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
global.addDebugLog = addDebugLog;

// Helper to fetch with timeout (default 15 seconds) to prevent infinite hangs
async function fetchWithTimeout(url, options = {}, timeout = 15000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
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
// Base Supabase URL
let internalSupabaseUrl = process.env.SUPABASE_URL || '';
if (internalSupabaseUrl.includes('localhost') || internalSupabaseUrl.includes('127.0.0.1')) {
  internalSupabaseUrl = internalSupabaseUrl.replace('localhost', 'supabase-kong').replace('127.0.0.1', 'supabase-kong');
}

let publicSupabaseUrl = internalSupabaseUrl;
// Em produção, a conexão direta via contêiner ou IP pode falhar no WebSocket (Realtime) devido a cabeçalhos de Host do Kong.
// Forçar o uso da URL pública com SSL garante que o WebSocket suba com sucesso através do Nginx.
if (process.env.NODE_ENV === 'production' || publicSupabaseUrl.includes('supabase-kong') || publicSupabaseUrl.includes('77.37.43.60')) {
    publicSupabaseUrl = 'https://pandanet.grupopixel.com.br';
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
// Client for queries (uses internal fast URL to avoid SSL/DNS/Proxy issues)
const supabase = createClient(internalSupabaseUrl, supabaseKey ? supabaseKey.trim() : '');
// Client for public Realtime websockets
const realtimeSupabase = createClient(publicSupabaseUrl, supabaseKey ? supabaseKey.trim() : '');

// --- AUTO-MIGRAÇÃO DE SCHEMA ---
async function runAutoMigration() {
    try {
        console.log('[MIGRATION] Verificando e adicionando coluna chatbot_delay à public.whatsapp_settings...');
        const { error } = await supabase.rpc('exec_sql', {
            sql: 'ALTER TABLE public.whatsapp_settings ADD COLUMN IF NOT EXISTS chatbot_delay INTEGER DEFAULT 0;'
        });
        if (error) {
            console.error('[MIGRATION] Erro ao executar RPC exec_sql para chatbot_delay:', error.message);
        } else {
            console.log('[MIGRATION] Auto-migração concluída com sucesso (coluna chatbot_delay).');
        }

        console.log('[MIGRATION] Verificando e adicionando coluna media_type à public.whatsapp_scheduled_campaigns...');
        const { error: errMedia } = await supabase.rpc('exec_sql', {
            sql: 'ALTER TABLE public.whatsapp_scheduled_campaigns ADD COLUMN IF NOT EXISTS media_type VARCHAR(50) DEFAULT \'image\';'
        });
        if (errMedia) {
            console.error('[MIGRATION] Erro ao adicionar media_type a whatsapp_scheduled_campaigns:', errMedia.message);
        } else {
            console.log('[MIGRATION] Auto-migração concluída com sucesso (coluna media_type em whatsapp_scheduled_campaigns).');
        }

        console.log('[MIGRATION] Verificando e criando tabela public.whatsapp_quick_messages se não existir...');
        const { error: errQuickMsg } = await supabase.rpc('exec_sql', {
            sql: `
                CREATE TABLE IF NOT EXISTS public.whatsapp_quick_messages (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
                    shortcut TEXT NOT NULL,
                    message TEXT NOT NULL,
                    is_public BOOLEAN DEFAULT TRUE,
                    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
            `
        });
        if (errQuickMsg) {
            console.error('[MIGRATION] Erro ao garantir whatsapp_quick_messages:', errQuickMsg.message);
        } else {
            console.log('[MIGRATION] Auto-migração da tabela whatsapp_quick_messages executada.');
        }

        console.log('[MIGRATION] Verificando e criando colunas adicionais para chatbot, retries e bloqueio de bot...');
        await supabase.rpc('exec_sql', {
            sql: `
                ALTER TABLE public.whatsapp_settings ADD COLUMN IF NOT EXISTS chatbot_max_retries INTEGER DEFAULT 2;
                ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS chatbot_retries INTEGER DEFAULT 0;
                ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS disable_bot BOOLEAN DEFAULT FALSE;
                ALTER TABLE public.whatsapp_settings ADD COLUMN IF NOT EXISTS chatbot_invalid_option_msg TEXT DEFAULT 'Opção inválida. Por favor, escolha uma das opções do menu:';
            `
        }).catch(e => console.error('[MIGRATION] Erro ao adicionar novas colunas de chatbot:', e));

        console.log('[MIGRATION] Verificando e criando coluna created_at nas tabelas de campanhas e alvos...');
        await supabase.rpc('exec_sql', {
            sql: `
                ALTER TABLE public.whatsapp_scheduled_targets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
                ALTER TABLE public.whatsapp_scheduled_campaigns ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
            `
        }).catch(e => console.error('[MIGRATION] Erro ao adicionar coluna created_at:', e));

        // Forçar o recarregamento do schema cache do PostgREST para o frontend enxergar todas as atualizações
        await supabase.rpc('exec_sql', { sql: "NOTIFY pgrst, 'reload schema';" });
        console.log('[MIGRATION] PostgREST schema cache recarregado com sucesso.');
    } catch (err) {
        console.error('[MIGRATION] Falha ao rodar auto-migração:', err.message);
    }
}
runAutoMigration();

// Cache em memória para IDs de mensagens processadas recentemente (anti-duplicação por concorrência)
const recentMessageIds = new Set();

global.realtimeStatus = {
    notifications: 'unknown',
    messages: 'unknown',
    whatsapp_messages: 'unknown'
};

// --- CONFIGURAÇÃO DO REALTIME PARA NOTIFICAÇÕES PUSH EM SEGUNDO PLANO ---
function setupPushNotificationsListener() {
    console.log('[FCM] Inicializando ouvintes do Supabase Realtime para notificações...');

    // 1. Ouvinte para a tabela: notifications
    realtimeSupabase
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
                    .select('push_token, role, email, is_admin, is_company_admin')
                    .eq('id', notif.user_id)
                    .single();

                if (error || !profile?.push_token) {
                    if (error) console.error('[FCM] Erro ao buscar token push do perfil:', error.message);
                    return;
                }

                const isMaster = profile.role === 'Super Admin' || 
                                 profile.is_company_admin === true || 
                                 profile.is_admin === true ||
                                 profile.email?.toLowerCase() === 'ti@grupopixel.com.br' ||
                                 profile.email?.toLowerCase() === 'ti@acrilight.com.br';
                if (!isMaster) {
                    console.log(`[FCM] Ignorando notificação push para usuário não master: ${profile.email}`);
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
        .subscribe((status, err) => {
            console.log(`[FCM] Status do canal de notifications: ${status}`);
            if (global.realtimeStatus) {
                global.realtimeStatus.notifications = status + (err ? ' - ' + err.message : '');
            }
            if (global.addDebugLog) {
                global.addDebugLog('FCM_REALTIME_STATUS', `Status do canal de notifications: ${status}`, err ? { error: err.message } : null);
            }
        });

    // 2. Ouvinte para a tabela: messages (Chat Interno)
    realtimeSupabase
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
                        .select('push_token, role, email, is_admin, is_company_admin')
                        .eq('id', p.user_id)
                        .maybeSingle();

                    if (prof?.push_token) {
                        const isMaster = prof.role === 'Super Admin' || 
                                         prof.is_company_admin === true || 
                                         prof.is_admin === true ||
                                         prof.email?.toLowerCase() === 'ti@grupopixel.com.br' ||
                                         prof.email?.toLowerCase() === 'ti@acrilight.com.br';
                        if (!isMaster) continue;

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
        .subscribe((status, err) => {
            console.log(`[FCM] Status do canal de messages: ${status}`);
            if (global.realtimeStatus) {
                global.realtimeStatus.messages = status + (err ? ' - ' + err.message : '');
            }
            if (global.addDebugLog) {
                global.addDebugLog('FCM_REALTIME_STATUS', `Status do canal de messages: ${status}`, err ? { error: err.message } : null);
            }
        });

    // 3. Ouvinte para a tabela: whatsapp_messages (WhatsPanda)
    realtimeSupabase
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
                        .select('push_token, role, email, is_admin, is_company_admin')
                        .eq('id', convInfo.assigned_to)
                        .maybeSingle();

                    if (agent?.push_token) {
                        const isMaster = agent.role === 'Super Admin' || 
                                         agent.is_company_admin === true || 
                                         agent.is_admin === true ||
                                         agent.email?.toLowerCase() === 'ti@grupopixel.com.br' ||
                                         agent.email?.toLowerCase() === 'ti@acrilight.com.br';
                        if (isMaster) {
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
                    }
                } else if (convInfo?.company_id) {
                    // Se não estiver atribuído, notifica administradores da mesma empresa
                    const { data: admins } = await supabase
                        .from('profiles')
                        .select('push_token, role, email, is_admin, is_company_admin')
                        .eq('company_id', convInfo.company_id)
                        .or('role.eq.Super Admin,is_admin.eq.true,is_company_admin.eq.true');

                    if (admins && admins.length > 0) {
                        for (const adminProf of admins) {
                            if (adminProf.push_token) {
                                const isMaster = adminProf.role === 'Super Admin' || 
                                                 adminProf.is_company_admin === true || 
                                                 adminProf.is_admin === true ||
                                                 adminProf.email?.toLowerCase() === 'ti@grupopixel.com.br' ||
                                                 adminProf.email?.toLowerCase() === 'ti@acrilight.com.br';
                                if (!isMaster) continue;

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
        .subscribe((status, err) => {
            console.log(`[FCM] Status do canal de whatsapp_messages: ${status}`);
            if (global.realtimeStatus) {
                global.realtimeStatus.whatsapp_messages = status + (err ? ' - ' + err.message : '');
            }
            if (global.addDebugLog) {
                global.addDebugLog('FCM_REALTIME_STATUS', `Status do canal de whatsapp_messages: ${status}`, err ? { error: err.message } : null);
            }
        });
}

// Inicializa os ouvintes
setupPushNotificationsListener();

// --- JWT Auth Middleware for Frontend Requests ---
async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (global.addDebugLog) {
      global.addDebugLog('AUTH_WARN', 'No Bearer token provided in Authorization header');
    }
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
        if (global.addDebugLog) {
            global.addDebugLog('AUTH_JWT_FAIL', `JWT local falhou: ${jwtErr.message}. Tentando Supabase getUser...`);
        }
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
          console.error('[AUTH] Supabase também falhou:', error?.message);
          if (global.addDebugLog) {
              global.addDebugLog('AUTH_SUPABASE_FAIL', `Supabase auth falhou: ${error?.message || 'Nenhum usuário retornado'}`);
          }
          return res.status(401).json({ error: 'Token inválido. Faça login novamente.' });
        }
        req.user = user;
        console.log(`[AUTH] Supabase auth OK para user: ${req.user.email}`);
      }
    } else {
      // Sem JWT_SECRET configurado, usa apenas Supabase
      console.warn('[AUTH] JWT_SECRET não configurado! Usando apenas Supabase auth.');
      if (global.addDebugLog) {
          global.addDebugLog('AUTH_NO_SECRET', 'JWT_SECRET não configurado! Usando apenas Supabase auth...');
      }
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        console.error('[AUTH] Supabase error (sem JWT_SECRET):', error?.message);
        if (global.addDebugLog) {
            global.addDebugLog('AUTH_SUPABASE_FAIL_NO_SECRET', `Supabase auth (sem secret) falhou: ${error?.message || 'Nenhum usuário retornado'}`);
        }
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
          if (global.addDebugLog) {
              global.addDebugLog('AUTH_PROFILE_NOT_FOUND', `Perfil não encontrado para usuário ${req.user.email || req.user.id}: ${profileErr?.message}`);
          }
          return res.status(403).json({ error: 'Forbidden: Perfil não encontrado' });
        }
      } else {
        const isMasterAdmin = profile.role === 'Super Admin' || req.user.email?.toLowerCase() === 'ti@grupopixel.com.br';
        if (!isMasterAdmin && profile.company_id !== companyId) {
          console.warn(`[AUTH] Acesso negado: User ${req.user.id} (Empresa ${profile.company_id}) tentou acessar Empresa ${companyId}`);
          if (global.addDebugLog) {
              global.addDebugLog('AUTH_FORBIDDEN', `Acesso negado: Usuário ${req.user.email} da Empresa ${profile.company_id} tentou acessar Empresa ${companyId}`);
          }
          return res.status(403).json({ error: 'Forbidden: Acesso a outra empresa negado' });
        }
      }
    }

    next();
  } catch (error) {
    console.error('[AUTH] Erro fatal no middleware:', error.message);
    if (global.addDebugLog) {
        global.addDebugLog('AUTH_FATAL', `Erro fatal no middleware de autenticação: ${error.message}`);
    }
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
  const { pairingNumber } = req.body;
  const instanceName = `conn_${connectionId}`;
  const webhookUrl = `${backendWebhookBaseUrl}/webhook/evolution/${companyId}/${connectionId}`;

  console.log(`[START] Requisitando Evolution para ${instanceName} (pairingNumber: ${pairingNumber || 'none'})...`);

  try {
    // 1. Tenta apagar a instância se já existir para forçar um recomeço limpo (com timeout de 15s)
    await fetchWithTimeout(`${evoUrl}/instance/logout/${instanceName}`, {
       method: 'DELETE',
       headers: { 'apikey': evoKey }
    }).catch(() => {});

    await fetchWithTimeout(`${evoUrl}/instance/delete/${instanceName}`, {
       method: 'DELETE',
       headers: { 'apikey': evoKey }
    }).catch(() => {});

    const isPairing = !!pairingNumber;

    // 2. Cria a instância com webhooks apontando para nós (com timeout de 15s)
    const createReq = await fetchWithTimeout(`${evoUrl}/instance/create`, {
        method: 'POST',
        headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            instanceName,
            qrcode: !isPairing,
            integration: "WHATSAPP-BAILEYS",
            webhook: webhookUrl,
            events: ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'MESSAGES_UPSERT']
        })
    });
    
    const createRes = await createReq.json();
    console.log('[EVOLUTION] Instância criada/buscada:', createRes);

    if (createReq.ok || createRes?.instance?.status) {
        // Reset connection status in Supabase and update phone number if pairing is requested
        const resetData = { 
            is_connected: false, 
            qr_code: null,
            pairing_code: null 
        };
        if (isPairing) {
            const cleanNumber = pairingNumber.replace(/\D/g, '');
            resetData.phone_number = cleanNumber;
            console.log(`[START] Atualizando número de telefone no banco para pareamento: ${cleanNumber}`);
        }

        await supabase.from('whatsapp_settings').update(resetData).eq('id', connectionId);

        if (isPairing) {
            const cleanNumber = pairingNumber.replace(/\D/g, '');
            console.log(`[START-PAIRING] Gerando código de pareamento para ${cleanNumber}...`);
            
            // Aguarda 2 segundos para o Evolution registrar a instância de forma limpa antes de gerar o código
            await new Promise(resolve => setTimeout(resolve, 2000));

            const connectReq = await fetchWithTimeout(`${evoUrl}/instance/connect/${instanceName}?number=${cleanNumber}`, {
                method: 'GET',
                headers: { 'apikey': evoKey }
            });
            const connectRes = await connectReq.json();
            console.log('[EVOLUTION] Resposta do código de pareamento:', connectRes);

            if (connectReq.ok && connectRes?.pairingCode) {
                await supabase.from('whatsapp_settings').update({ 
                    pairing_code: connectRes.pairingCode 
                }).eq('id', connectionId);
                return res.json({ status: 'success', pairingCode: connectRes.pairingCode });
            } else {
                return res.status(500).json({ error: 'Falha ao obter código de pareamento da Evolution API', detail: connectRes });
            }
        }

        res.json({ status: 'success', message: `Sessão iniciada.` });
    } else {
        res.status(500).json({ error: 'Falha ao criar instância Evolution', detail: createRes });
    }
  } catch (error) {
    console.error('[START] Erro fatal Evolution:', error.message);
    const isTimeout = error.name === 'AbortError' || error.message.includes('aborted');
    res.status(500).json({ 
        error: isTimeout ? 'Tempo limite esgotado ao contatar Evolution API' : 'Evolution indisponível', 
        details: error.message 
    });
  }
});

// API: Parar Sessão
router.post('/sessions/:companyId/stop/:connectionId', authMiddleware, async (req, res) => {
  const { connectionId } = req.params;
  const instanceName = `conn_${connectionId}`;

  try {
    await fetchWithTimeout(`${evoUrl}/instance/logout/${instanceName}`, {
       method: 'DELETE',
       headers: { 'apikey': evoKey }
    }).catch(() => {});
    await fetchWithTimeout(`${evoUrl}/instance/delete/${instanceName}`, {
       method: 'DELETE',
       headers: { 'apikey': evoKey }
    }).catch(() => {});
    
    await supabase.from('whatsapp_settings').update({ is_connected: false, qr_code: null, pairing_code: null }).eq('id', connectionId);
    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deslogar Evolution', details: error.message });
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
    const { message, mediaUrl, mediaType, keepClosed } = req.body;
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
            // Envia no formato padrão suportado pela Evolution API da VPS (textMessage)
            const sendReq = await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
                method: 'POST',
                headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: phoneNumber, textMessage: { text: message } })
            });
            try { sendRes = await sendReq.json(); } catch(e) { sendRes = {}; }
            console.log(`[SEND API] Resposta sendText (${sendReq.status}):`, JSON.stringify(sendRes));
            if (sendReq.ok && !sendRes?.error) {
                sendOk = true;
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
                whatsapp_message_id: sendRes?.key?.id || undefined,
                queue_id: conv.queue_id || null
            })
            .select()
            .single();

        if (msgErr) {
            console.error('[SEND API] Erro ao salvar mensagem no Supabase:', msgErr);
        }
        
        // 4. Update conversation timestamp
        const nextStatus = keepClosed 
            ? 'fechado' 
            : ((conv.status === 'fechado' || conv.status === 'pendente') ? 'aberto' : conv.status);
        const nextAssignedTo = keepClosed 
            ? null 
            : ((!conv.assigned_to || conv.status === 'fechado') ? userId : conv.assigned_to);

        await supabase
            .from('whatsapp_conversations')
            .update({ 
                last_message_at: new Date().toISOString(),
                status: nextStatus,
                assigned_to: nextAssignedTo,
                queue_id: keepClosed ? null : conv.queue_id,
                chatbot_node_id: keepClosed ? null : conv.chatbot_node_id,
                closed_at: keepClosed ? new Date().toISOString() : conv.closed_at
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
        
        if (internalSupabaseUrl) {
            const storageIndex = url.indexOf('/storage/v1/object/public/');
            if (storageIndex !== -1) {
                const storagePath = url.substring(storageIndex);
                const base = internalSupabaseUrl.endsWith('/') ? internalSupabaseUrl.slice(0, -1) : internalSupabaseUrl;
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
        const connectionId = instanceName.replace('conn_', '');
        const { data: conn } = await supabase
            .from('whatsapp_settings')
            .select('reject_calls, rejection_message')
            .eq('id', connectionId)
            .maybeSingle();

        const rejectCall = conn ? !!conn.reject_calls : false;
        const msgCall = conn?.rejection_message || "";

        const resp = await fetch(`${evoUrl}/settings/set/${instanceName}`, {
            method: 'POST',
            headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reject_call: rejectCall,
                msg_call: msgCall,
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

// API: Status de Conexão Realtime
router.get('/realtime-status', (req, res) => {
    res.json({
        supabase_url: supabaseUrl,
        has_service_key: !!supabaseKey,
        realtime_status: global.realtimeStatus
    });
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


function formatMenuText(node) {
    let text = node.content?.text || "";
    const options = node.content?.options || [];
    if (options.length > 0) {
        const optionsList = options.map((opt, idx) => {
            const label = opt.label || "";
            // Se o label já começa com um número (ex: "1. Algo", "1 - Algo"), mantemos. Caso contrário, numeramos.
            if (/^\d+[\.\-\s]/.test(label)) {
                return label;
            }
            return `${idx + 1}. ${label}`;
        }).join('\n');
        text = `${text}\n\n${optionsList}`;
    }
    return text;
}

async function dispatchTextEvolution(instanceName, phoneNumber, text) {
    const cleanNumber = (phoneNumber || "").replace(/\D/g, "");
    let sendOk = false;
    let sendRes = {};
    try {
        const res = await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                number: cleanNumber,
                textMessage: { text: text }
            })
        });
        try { sendRes = await res.json(); } catch(e) { sendRes = {}; }
        console.log(`[EVO DISPATCH] Resposta sendText (${res.status}):`, JSON.stringify(sendRes));
        if (res.ok && !sendRes?.error) {
            sendOk = true;
        }

        if (!sendOk) {
            console.error(`[EVO DISPATCH] FALHA ao enviar para ${cleanNumber}. Resposta:`, JSON.stringify(sendRes));
        }
    } catch (e) {
        console.error('[EVO DISPATCH] Erro de rede/conexão:', e.message);
    }
    return sendOk;
}

async function sendBotMessage(text, conversation, companyId, connectionId) {
    if (!text) return;
    const instanceName = `conn_${connectionId}`;
    
    // Buscar delay do chatbot nas configurações da conexão
    let delayMs = 0;
    try {
        const { data: settings } = await supabase
            .from('whatsapp_settings')
            .select('chatbot_delay')
            .eq('id', connectionId)
            .maybeSingle();
        
        if (settings && settings.chatbot_delay) {
            delayMs = parseInt(settings.chatbot_delay, 10) * 1000;
        }
    } catch (delayErr) {
        console.error('[CHATBOT] Erro ao carregar chatbot_delay:', delayErr.message);
    }

    if (delayMs > 0) {
        console.log(`[CHATBOT] Aplicando delay de ${delayMs}ms. Enviando presença 'composing'...`);
        const cleanNumber = conversation.contact_phone.replace(/\D/g, "");
        try {
            await fetch(`${evoUrl}/chat/sendPresence/${instanceName}`, {
                method: 'POST',
                headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    number: cleanNumber,
                    presence: 'composing',
                    delay: delayMs
                })
            });
        } catch (presErr) {
            console.warn('[CHATBOT-PRESENCE] Erro ao enviar presença:', presErr.message);
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    await dispatchTextEvolution(instanceName, conversation.contact_phone, text);

    try {
        await supabase.from('whatsapp_messages').insert({
            company_id: companyId,
            conversation_id: conversation.id,
            message_text: text,
            is_from_customer: false,
            sent_by: null, // null indica bot
            queue_id: conversation.queue_id || null
        });
    } catch (e) {
        console.error('[CHATBOT] Erro ao salvar msg no banco:', e.message);
    }
}

async function executeNode(node, conversation, companyId, connectionId, allNodes) {
    if (node.type === 'transfer_queue') {
        const queueId = node.content?.queue_id;
        await supabase.from('whatsapp_conversations').update({ 
            queue_id: queueId, 
            chatbot_node_id: null 
        }).eq('id', conversation.id);
        
        await sendBotMessage("Encaminhando seu atendimento para o setor responsável...", conversation, companyId, connectionId);
    } else if (node.type === 'transfer_user') {
        const userId = node.content?.user_id;
        await supabase.from('whatsapp_conversations').update({ 
            assigned_to: userId, 
            chatbot_node_id: null 
        }).eq('id', conversation.id);

        await sendBotMessage("Encaminhando seu atendimento para um atendente...", conversation, companyId, connectionId);
    } else if (node.type === 'menu') {
        const menuText = formatMenuText(node);
        await sendBotMessage(menuText, conversation, companyId, connectionId);
        await supabase.from('whatsapp_conversations').update({ chatbot_node_id: node.id }).eq('id', conversation.id);
    } else if (node.type === 'message') {
        const text = node.content?.text || "";
        if (text) {
            await sendBotMessage(text, conversation, companyId, connectionId);
        }
        await supabase.from('whatsapp_conversations').update({ chatbot_node_id: node.id }).eq('id', conversation.id);
    } else if (node.type === 'greeting') {
        const text = node.content?.text || "";
        if (text) {
            await sendBotMessage(text, conversation, companyId, connectionId);
        }
        const idx = allNodes.indexOf(node);
        const nextNode = allNodes.find((n, i) => i > idx && n.type !== 'greeting');
        if (nextNode) {
            await executeNode(nextNode, conversation, companyId, connectionId, allNodes);
        } else {
            await supabase.from('whatsapp_conversations').update({ chatbot_node_id: null }).eq('id', conversation.id);
        }
    }
}

async function runChatbot(incomingText, conversation, companyId, connectionId) {
    try {
        const { data: dbConv } = await supabase
            .from('whatsapp_conversations')
            .select('queue_id, assigned_to')
            .eq('id', conversation.id)
            .maybeSingle();

        if (dbConv && (dbConv.queue_id || dbConv.assigned_to)) {
            console.log(`[CHATBOT] Ignorando chatbot para conversa ${conversation.id} porque já está em fila (${dbConv.queue_id}) ou atribuída a um atendente (${dbConv.assigned_to}).`);
            return;
        }

        const text = (incomingText || "").trim().toLowerCase();
        if (!text) return;

        // 1. Verificar transferências por palavra-chave configuradas
        try {
            const { data: settings } = await supabase
                .from('whatsapp_settings')
                .select('keyword_transfers')
                .eq('id', connectionId)
                .maybeSingle();

            if (settings && Array.isArray(settings.keyword_transfers) && settings.keyword_transfers.length > 0) {
                // Procurar por uma palavra-chave que esteja contida na mensagem do cliente (case-insensitive)
                const matchedRule = settings.keyword_transfers.find(rule => {
                    const kw = (rule.keyword || "").trim().toLowerCase();
                    return kw && text.includes(kw);
                });

                if (matchedRule) {
                    console.log(`[PALAVRA-CHAVE] Mensagem casou com palavra-chave "${matchedRule.keyword}". Transferindo...`);
                    
                    if (matchedRule.target_type === 'queue') {
                        // Transferir para Fila/Setor
                        const { data: queue } = await supabase
                            .from('whatsapp_queues')
                            .select('name')
                            .eq('id', matchedRule.target_id)
                            .maybeSingle();
                        
                        const queueName = queue?.name || "Setor Responsável";
                        const transferText = `Certo! Entendi seu interesse. Vou transferir seu atendimento para o setor de *${queueName}*. Um momento, por favor.`;
                        
                        await sendBotMessage(transferText, conversation, companyId, connectionId);
                        
                        await supabase.from('whatsapp_conversations').update({ 
                            queue_id: matchedRule.target_id, 
                            chatbot_node_id: null,
                            assigned_to: null
                        }).eq('id', conversation.id);
                        
                        return; // Interrompe o chatbot
                    } else if (matchedRule.target_type === 'agent') {
                        // Transferir para Agente/Usuário
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('full_name')
                            .eq('id', matchedRule.target_id)
                            .maybeSingle();
                        
                        const agentName = profile?.full_name || "um atendente";
                        const transferText = `Certo! Vou transferir seu atendimento para o consultor *${agentName}*. Um momento, por favor.`;
                        
                        await sendBotMessage(transferText, conversation, companyId, connectionId);
                        
                        await supabase.from('whatsapp_conversations').update({ 
                            assigned_to: matchedRule.target_id, 
                            chatbot_node_id: null,
                            queue_id: null
                        }).eq('id', conversation.id);
                        
                        return; // Interrompe o chatbot
                    }
                }
            }
        } catch (kwErr) {
            console.error('[PALAVRA-CHAVE] Erro ao processar regras de palavra-chave:', kwErr.message);
        }

        // 2. Buscar fluxo ativo
        const { data: flow } = await supabase
            .from('whatsapp_chatbot_flows')
            .select('*')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .maybeSingle();
        if (!flow) return;

        // Buscar todos os nós do fluxo ordenados por sort_order ASC
        const { data: nodes, error: nodesErr } = await supabase
            .from('whatsapp_chatbot_nodes')
            .select('*')
            .eq('flow_id', flow.id)
            .order('sort_order', { ascending: true });
        
        if (nodesErr || !nodes || nodes.length === 0) return;

        // Buscar versão mais recente da conversa para garantir integridade do contador
        const { data: freshConv } = await supabase
            .from('whatsapp_conversations')
            .select('chatbot_node_id, chatbot_retries')
            .eq('id', conversation.id)
            .maybeSingle();

        const currentConv = freshConv || conversation;
        let currentNodeId = currentConv.chatbot_node_id;
        let currentNode = currentNodeId ? nodes.find(n => n.id === currentNodeId) : null;

        // Se o nó atual for do tipo menu, processar a resposta do usuário
        if (currentNode && currentNode.type === 'menu') {
            const options = currentNode.content?.options || [];
            // Tenta achar a opção pelo número ou pela label exata (case insensitive)
            const selectedOption = options.find((opt, idx) => {
                const optNum = (idx + 1).toString();
                const cleanLabel = (opt.label || "").trim().toLowerCase();
                const labelWithoutPrefix = cleanLabel.replace(/^\d+[\.\-\s]*/, '').trim();
                const textWithoutPrefix = text.replace(/^\d+[\.\-\s]*/, '').trim();
                
                return text === optNum || 
                       text === cleanLabel || 
                       text === labelWithoutPrefix ||
                       textWithoutPrefix === labelWithoutPrefix;
            });

            if (selectedOption) {
                const nextNode = nodes.find(n => n.id === selectedOption.next_node);
                if (nextNode) {
                    // Resposta válida: zera as tentativas
                    await supabase
                        .from('whatsapp_conversations')
                        .update({ chatbot_retries: 0 })
                        .eq('id', conversation.id);
                    await executeNode(nextNode, conversation, companyId, connectionId, nodes);
                } else {
                    await sendBotMessage("🤖 Opção configurada sem destino. Por favor, tente novamente.", conversation, companyId, connectionId);
                    await executeNode(currentNode, conversation, companyId, connectionId, nodes);
                }
            } else {
                // Resposta inválida: busca limite de tentativas (chatbot_max_retries) e mensagem customizada da whatsapp_settings
                let maxRetries = 2;
                let invalidOptionMsg = "Opção inválida. Por favor, escolha uma das opções do menu:";
                try {
                    const { data: settings } = await supabase
                        .from('whatsapp_settings')
                        .select('chatbot_max_retries, chatbot_invalid_option_msg')
                        .eq('id', connectionId)
                        .maybeSingle();
                    if (settings) {
                        if (settings.chatbot_max_retries !== undefined) {
                            maxRetries = settings.chatbot_max_retries;
                        }
                        if (settings.chatbot_invalid_option_msg) {
                            invalidOptionMsg = settings.chatbot_invalid_option_msg;
                        }
                    }
                } catch (e) {
                    console.error('[CHATBOT] Erro ao ler configurações do chatbot:', e.message);
                }

                // Incrementa a tentativa
                const currentRetries = (currentConv.chatbot_retries || 0) + 1;

                if (currentRetries >= maxRetries) {
                    // Limite atingido: avisa e finaliza bot (atribui chatbot_node_id = null e chatbot_retries = 0)
                    await sendBotMessage("Não entendi a sua resposta. Encaminhando você para nossos atendentes...", conversation, companyId, connectionId);
                    await supabase
                        .from('whatsapp_conversations')
                        .update({ chatbot_node_id: null, chatbot_retries: 0 })
                        .eq('id', conversation.id);
                } else {
                    // Ainda não atingiu o limite: incrementa e repete o menu
                    await supabase
                        .from('whatsapp_conversations')
                        .update({ chatbot_retries: currentRetries })
                        .eq('id', conversation.id);
                    
                    await sendBotMessage(invalidOptionMsg, conversation, companyId, connectionId);
                    await executeNode(currentNode, conversation, companyId, connectionId, nodes);
                }
            }
        } else {
            // Se chatbot_node_id for nulo ou se o nó atual não for um 'menu'
            // Envia a saudação (se existir) + a mensagem do nó seguinte (geralmente menu)
            const greetingNode = nodes.find(n => n.type === 'greeting');
            if (greetingNode) {
                const greetingText = greetingNode.content?.text || "";
                if (greetingText) {
                    await sendBotMessage(greetingText, conversation, companyId, connectionId);
                }
            }

            // Achar o nó seguinte ao greeting
            const greetingIndex = greetingNode ? nodes.indexOf(greetingNode) : -1;
            const nextNode = nodes.find((n, idx) => idx > greetingIndex && n.type !== 'greeting');

            if (nextNode) {
                await executeNode(nextNode, conversation, companyId, connectionId, nodes);
            } else {
                await supabase.from('whatsapp_conversations').update({ chatbot_node_id: null }).eq('id', conversation.id);
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
            
            // Tentar extrair a mensagem de forma inteligente
            let payloadMessage;
            if (mediatype === 'sticker' || mediatype === 'gif') {
                // Para sticker e gif, o payload simplificado costuma funcionar melhor pois evita urls/dados quebrados
                if (attempt === 1) {
                    payloadMessage = {
                        key: {
                            id: message.key.id,
                            fromMe: message.key.fromMe,
                            remoteJid: message.key.remoteJid
                        }
                    };
                } else {
                    const cleanMessage = JSON.parse(JSON.stringify(message));
                    const unwrap = (obj) => {
                        if (obj.message?.ephemeralMessage) obj.message = obj.message.ephemeralMessage.message;
                        if (obj.message?.viewOnceMessage) obj.message = obj.message.viewOnceMessage.message;
                        if (obj.message?.viewOnceMessageV2) obj.message = obj.message.viewOnceMessageV2.message;
                        if (obj.message?.documentWithCaptionMessage) obj.message = obj.message.documentWithCaptionMessage.message;
                    };
                    unwrap(cleanMessage);
                    payloadMessage = cleanMessage;
                }
            } else {
                // Outras mídias tentam primeiro o objeto completo (legado)
                if (attempt === 1) {
                    const cleanMessage = JSON.parse(JSON.stringify(message));
                    const unwrap = (obj) => {
                        if (obj.message?.ephemeralMessage) obj.message = obj.message.ephemeralMessage.message;
                        if (obj.message?.viewOnceMessage) obj.message = obj.message.viewOnceMessage.message;
                        if (obj.message?.viewOnceMessageV2) obj.message = obj.message.viewOnceMessageV2.message;
                        if (obj.message?.documentWithCaptionMessage) obj.message = obj.message.documentWithCaptionMessage.message;
                    };
                    unwrap(cleanMessage);
                    payloadMessage = cleanMessage;
                } else {
                    payloadMessage = {
                        key: {
                            id: message.key.id,
                            fromMe: message.key.fromMe,
                            remoteJid: message.key.remoteJid
                        }
                    };
                }
            }

            const resp = await fetch(`${evoUrl}/chat/${endpoint}/${instanceName}`, {
                method: 'POST',
                headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: payloadMessage
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

/**
 * Retorna { inHours: boolean, awayMessage: string | null }
 */
async function checkBusinessHours(companyId, connectionId, queueId = null) {
    // Criar a data correspondente ao fuso de São Paulo de forma robusta e independente da VPS
    const spTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const currentDayStr = spTime.getDay().toString(); // "0" (domingo) a "6" (sábado)
    const currentHourStr = `${spTime.getHours().toString().padStart(2, '0')}:${spTime.getMinutes().toString().padStart(2, '0')}`;

    // 1. Buscar configurações da conexão do WhatsApp
    const { data: settings } = await supabase
        .from('whatsapp_settings')
        .select('business_hours, business_hours_start, business_hours_end, away_message')
        .eq('id', connectionId)
        .maybeSingle();

    if (!settings) {
        return { inHours: true, awayMessage: null };
    }

    const awayMessage = settings.away_message || 'Estamos fora do horário de atendimento. Deixe sua mensagem que responderemos assim que possível.';

    // 2. Se houver configuração business_hours JSONB
    if (settings.business_hours) {
        const bh = settings.business_hours;
        let dayConfig = null;

        // Se passamos queueId, tentar achar expediente da fila
        if (queueId && bh.queues && bh.queues[queueId]) {
            dayConfig = bh.queues[queueId][currentDayStr];
            if (dayConfig) {
                // Se dayConfig existe e é um array de intervalos
                const inRange = dayConfig.some(interval => currentHourStr >= interval.start && currentHourStr <= interval.end);
                if (inRange) {
                    return { inHours: true, awayMessage: null };
                } else {
                    return { inHours: false, awayMessage: 'Estamos fora do horário de expediente deste setor.' };
                }
            } else {
                // Se dayConfig for nulo/vazio, significa que o setor está fechado neste dia (ou não cadastrou)
                // Se foi configurado a fila no JSONB mas não há expediente para esse dia, assume FECHADO para essa fila
                return { inHours: false, awayMessage: 'Estamos fora do horário de expediente deste setor.' };
            }
        }

        // Se não achou na fila ou não passou queueId, verificar no Geral (general)
        if (bh.general && bh.general[currentDayStr]) {
            dayConfig = bh.general[currentDayStr];
            const inRange = dayConfig.some(interval => currentHourStr >= interval.start && currentHourStr <= interval.end);
            if (inRange) {
                return { inHours: true, awayMessage: null };
            } else {
                return { inHours: false, awayMessage };
            }
        }
    }

    // 3. Fallback: Lógica Legada (business_hours_start / business_hours_end)
    const start = settings.business_hours_start ? settings.business_hours_start.slice(0, 5) : null;
    const end = settings.business_hours_end ? settings.business_hours_end.slice(0, 5) : null;

    if (start && end) {
        if (currentHourStr < start || currentHourStr > end) {
            return { inHours: false, awayMessage };
        }
        const isWeekend = spTime.getDay() === 0 || spTime.getDay() === 6;
        if (isWeekend) {
            return { inHours: false, awayMessage };
        }
    }

    return { inHours: true, awayMessage: null };
}

const activeCreations = new Map(); // key: `${companyId}_${fromPhone}` -> Promise<conversationId>

async function processInboundMessage(message, companyId, connectionId, isHistorical = false) {
    try {
        const isFromMe = message.key?.fromMe;
        let remoteJid = message.key?.remoteJid || '';
        const msgId = message.key?.id;

        if (msgId) {
            if (recentMessageIds.has(msgId)) {
                console.log(`[MSG] Ignorando processamento duplicado em concorrência para ID: ${msgId}`);
                return;
            }
            recentMessageIds.add(msgId);
            setTimeout(() => recentMessageIds.delete(msgId), 15000);
        }
        
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

        // 0. Verificar se o contato está bloqueado ou com bot desabilitado
        let disableBotForContact = false;
        if (!isGroup) {
            const { data: contact } = await supabase
                .from('whatsapp_contacts')
                .select('is_blocked, disable_bot')
                .eq('company_id', companyId)
                .eq('phone', fromPhone)
                .maybeSingle();

            if (contact?.is_blocked) {
                console.log(`[BOT] Contato ${fromPhone} bloqueado.`);
                addDebugLog('MSG_BLOCKED', `Contato ${fromPhone} está bloqueado.`);
                return;
            }
            if (contact?.disable_bot) {
                disableBotForContact = true;
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
                let extraUpdates = {};
                if (conv.status === 'fechado') {
                    nextStatus = 'aberto';
                    extraUpdates = {
                        assigned_to: null,
                        queue_id: null,
                        chatbot_node_id: null
                    };
                    conv.assigned_to = null;
                    conv.queue_id = null;
                    conv.chatbot_node_id = null;
                    conv.status = 'aberto';
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
                        contact_name: resolvedName,
                        ...extraUpdates
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
            let existingId = null;
            if (isFromMe && text) {
                // Buscar mensagem idêntica criada recentemente (últimos 15 segundos) na mesma conversa que não tenha whatsapp_message_id
                const fifteenSecondsAgo = new Date(Date.now() - 15000).toISOString();
                const { data: recentMsg } = await supabase
                    .from('whatsapp_messages')
                    .select('id')
                    .eq('conversation_id', conversationId)
                    .eq('message_text', text)
                    .is('whatsapp_message_id', null)
                    .gte('created_at', fifteenSecondsAgo)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (recentMsg) {
                    existingId = recentMsg.id;
                    console.log(`[MSG] Associando ID real ${msgId} à mensagem manual pré-existente: ${existingId}`);
                }
            }

            if (existingId) {
                // Atualizar a mensagem existente com o ID real da Evolution
                const { error: updateErr } = await supabase
                    .from('whatsapp_messages')
                    .update({ 
                        whatsapp_message_id: msgId,
                        created_at: parseMessageTimestamp(message.messageTimestamp)
                    })
                    .eq('id', existingId);

                if (updateErr) {
                    addDebugLog('MSG_UPDATE_ID_ERR', `Erro ao atualizar ID ${msgId} na msg ${existingId}: ${updateErr.message}`);
                } else {
                    addDebugLog('MSG_UPDATE_ID_OK', `ID ${msgId} associado à mensagem manual pré-existente ${existingId}`);
                }
            } else {
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
                    created_at: parseMessageTimestamp(message.messageTimestamp),
                    queue_id: conv ? conv.queue_id : null
                });

                if (insertErr) {
                    addDebugLog('MSG_INSERT_ERR', `Erro ao inserir mensagem ${msgId} na conv ${conversationId}: ${insertErr.message}`, insertErr);
                    throw insertErr;
                } else {
                    addDebugLog('MSG_INSERT_OK', `Mensagem ${msgId} salva com sucesso na conv ${conversationId}`);
                }
            }

            if (!isHistorical && !isFromMe && !isGroup) {
                // Verificar Expediente e Horários de Ausência (com limitador anti-spam de 2 horas)
                try {
                    const currentConv = conv || { id: conversationId, queue_id: null, last_away_message_at: null };
                    const { inHours, awayMessage } = await checkBusinessHours(companyId, connectionId, currentConv.queue_id);
                    if (!inHours && awayMessage) {
                        const lastAway = currentConv.last_away_message_at ? new Date(currentConv.last_away_message_at).getTime() : 0;
                        const twoHoursMs = 2 * 60 * 60 * 1000;
                        if (Date.now() - lastAway > twoHoursMs) {
                            console.log(`[MSG] Fora do expediente. Enviando mensagem de ausência para ${fromPhone}`);
                            
                            // Atualizar timestamp anti-spam no banco
                            await supabase
                                .from('whatsapp_conversations')
                                .update({ last_away_message_at: new Date().toISOString() })
                                .eq('id', conversationId);

                            // Enviar mensagem via Evolution API
                            const instanceName = `conn_${connectionId}`;
                            dispatchTextEvolution(instanceName, fromPhone, awayMessage)
                                .catch(e => console.error('[EXPEDIENTE] Erro ao enviar mensagem de ausência:', e.message));

                            // Inserir registro no chat
                            await supabase.from('whatsapp_messages').insert({
                                company_id: companyId,
                                conversation_id: conversationId,
                                message_text: awayMessage,
                                is_from_customer: false,
                                sent_by: null,
                                queue_id: conv ? conv.queue_id : null
                            });
                        }
                    } else {
                        // Só executa o chatbot/IA se estiver dentro do horário de expediente
                        const currentConv = conv || { id: conversationId, contact_phone: fromPhone, queue_id: null, assigned_to: null };
                        
                        let chatbotMode = 'disabled';
                        let geminiKey = null;
                        let businessHours = null;

                        if (disableBotForContact) {
                            console.log(`[CHATBOT] Chatbot desabilitado para o contato: ${fromPhone}`);
                        } else {
                            try {
                                const { data: settings } = await supabase
                                    .from('whatsapp_settings')
                                    .select('chatbot_mode, gemini_api_key, business_hours')
                                    .eq('id', connectionId)
                                    .maybeSingle();

                                if (settings) {
                                    chatbotMode = settings.chatbot_mode || 'disabled';
                                    geminiKey = settings.gemini_api_key;
                                    businessHours = settings.business_hours;
                                }
                            } catch (err) {
                                console.error('[CHATBOT-MODE] Erro ao carregar configurações da conexão:', err.message);
                            }
                        }

                        let hasTransferred = false;

                        // 1. Verificar transferências por palavra-chave se bot estiver ativo
                        if (chatbotMode !== 'disabled' && !currentConv.queue_id && !currentConv.assigned_to) {
                            try {
                                const { data: settings } = await supabase
                                    .from('whatsapp_settings')
                                    .select('keyword_transfers')
                                    .eq('id', connectionId)
                                    .maybeSingle();

                                if (settings && Array.isArray(settings.keyword_transfers) && settings.keyword_transfers.length > 0) {
                                    const textLower = (text || "").trim().toLowerCase();
                                    const matchedRule = settings.keyword_transfers.find(rule => {
                                        const kw = (rule.keyword || "").trim().toLowerCase();
                                        return kw && textLower.includes(kw);
                                    });

                                    if (matchedRule) {
                                        console.log(`[PALAVRA-CHAVE] Mensagem casou com palavra-chave "${matchedRule.keyword}". Transferindo...`);
                                        if (matchedRule.target_type === 'queue') {
                                            const { data: queue } = await supabase
                                                .from('whatsapp_queues')
                                                .select('name')
                                                .eq('id', matchedRule.target_id)
                                                .maybeSingle();
                                            
                                            const queueName = queue?.name || "Setor Responsável";
                                            const transferText = `Certo! Entendi seu interesse. Vou transferir seu atendimento para o setor de *${queueName}*. Um momento, por favor.`;
                                            
                                            const instanceName = `conn_${connectionId}`;
                                            await dispatchTextEvolution(instanceName, fromPhone, transferText)
                                                .catch(e => console.error('[PALAVRA-CHAVE] Erro ao enviar notificação:', e.message));

                                            await supabase.from('whatsapp_messages').insert({
                                                company_id: companyId,
                                                conversation_id: conversationId,
                                                message_text: transferText,
                                                is_from_customer: false,
                                                sent_by: null,
                                                queue_id: matchedRule.target_id
                                            });

                                            await supabase.from('whatsapp_conversations').update({ 
                                                queue_id: matchedRule.target_id, 
                                                chatbot_node_id: null,
                                                assigned_to: null
                                            }).eq('id', conversationId);

                                            hasTransferred = true;
                                        } else if (matchedRule.target_type === 'agent') {
                                            const { data: profile } = await supabase
                                                .from('profiles')
                                                .select('full_name')
                                                .eq('id', matchedRule.target_id)
                                                .maybeSingle();
                                            
                                            const agentName = profile?.full_name || "um atendente";
                                            const transferText = `Certo! Vou transferir seu atendimento para o consultor *${agentName}*. Um momento, por favor.`;
                                            
                                            const instanceName = `conn_${connectionId}`;
                                            await dispatchTextEvolution(instanceName, fromPhone, transferText)
                                                .catch(e => console.error('[PALAVRA-CHAVE] Erro ao enviar notificação:', e.message));

                                            await supabase.from('whatsapp_messages').insert({
                                                company_id: companyId,
                                                conversation_id: conversationId,
                                                message_text: transferText,
                                                is_from_customer: false,
                                                sent_by: null,
                                                assigned_to: matchedRule.target_id
                                            });

                                            await supabase.from('whatsapp_conversations').update({ 
                                                assigned_to: matchedRule.target_id, 
                                                chatbot_node_id: null,
                                                queue_id: null
                                            }).eq('id', conversationId);

                                            hasTransferred = true;
                                        }
                                    }
                                }
                            } catch (kwErr) {
                                console.error('[PALAVRA-CHAVE] Erro ao processar regras de palavra-chave:', kwErr.message);
                            }
                        }

                        // Se o modo de triagem por IA estiver ativo e não houver fila nem agente atribuído e não foi transferido por palavra-chave
                        if (chatbotMode === 'gemini' && geminiKey && !currentConv.queue_id && !currentConv.assigned_to && !hasTransferred) {
                            try {
                                const { data: queues } = await supabase
                                    .from('whatsapp_queues')
                                    .select('id, name')
                                    .eq('company_id', companyId);

                                const { data: team } = await supabase
                                    .from('profiles')
                                    .select('id, full_name')
                                    .eq('company_id', companyId);

                                if ((queues && queues.length > 0) || (team && team.length > 0)) {
                                    const suggestion = await analyzeMessageForTransfer(
                                        text, 
                                        queues || [], 
                                        team || [], 
                                        geminiKey, 
                                        businessHours
                                    );

                                    if (suggestion && suggestion.target_type === 'queue' && suggestion.target_id) {
                                        console.log(`[IA TRIAGEM] Sugeriu transferir para fila: ${suggestion.target_id}`);
                                        addDebugLog('IA_TRIAGEM_OK', `Transferência automática via IA para fila ${suggestion.target_id} sugerida com sucesso.`);
                                        
                                        await supabase
                                            .from('whatsapp_conversations')
                                            .update({ queue_id: suggestion.target_id, chatbot_node_id: null, assigned_to: null })
                                            .eq('id', conversationId);
                                        
                                        const destQueue = queues.find(q => q.id === suggestion.target_id);
                                        const notifyText = suggestion.response || `Olá! Entendi seu interesse. Vou transferir seu atendimento para o setor de *${destQueue.name}*. Um momento, por favor.`;
                                        
                                        const instanceName = `conn_${connectionId}`;
                                        await dispatchTextEvolution(instanceName, fromPhone, notifyText)
                                            .catch(e => console.error('[IA TRIAGEM] Erro ao enviar notificação:', e.message));

                                        await supabase.from('whatsapp_messages').insert({
                                            company_id: companyId,
                                            conversation_id: conversationId,
                                            message_text: notifyText,
                                            is_from_customer: false,
                                            sent_by: null,
                                            queue_id: suggestion.target_id
                                        });

                                        hasTransferred = true;
                                    } else if (suggestion && suggestion.target_type === 'agent' && suggestion.target_id) {
                                        console.log(`[IA TRIAGEM] Sugeriu transferir para agente: ${suggestion.target_id}`);
                                        addDebugLog('IA_TRIAGEM_AGENT_OK', `Transferência automática via IA para agente ${suggestion.target_id} sugerida com sucesso.`);
                                        
                                        await supabase
                                            .from('whatsapp_conversations')
                                            .update({ assigned_to: suggestion.target_id, chatbot_node_id: null, queue_id: null })
                                            .eq('id', conversationId);
                                        
                                        const destAgent = team.find(u => u.id === suggestion.target_id);
                                        const notifyText = suggestion.response || `Olá! Vou transferir você para o especialista *${destAgent.full_name}*. Por favor, aguarde um instante.`;
                                        
                                        const instanceName = `conn_${connectionId}`;
                                        await dispatchTextEvolution(instanceName, fromPhone, notifyText)
                                            .catch(e => console.error('[IA TRIAGEM] Erro ao enviar notificação para agente:', e.message));

                                        await supabase.from('whatsapp_messages').insert({
                                            company_id: companyId,
                                            conversation_id: conversationId,
                                            message_text: notifyText,
                                            is_from_customer: false,
                                            sent_by: null,
                                            assigned_to: suggestion.target_id
                                        });

                                        hasTransferred = true;
                                    } else if (suggestion && suggestion.target_type === 'none' && suggestion.response) {
                                        console.log(`[IA TRIAGEM] Enviando resposta conversacional do Gemini.`);
                                        
                                        const instanceName = `conn_${connectionId}`;
                                        await dispatchTextEvolution(instanceName, fromPhone, suggestion.response)
                                            .catch(e => console.error('[IA TRIAGEM] Erro ao enviar resposta conversacional:', e.message));

                                        await supabase.from('whatsapp_messages').insert({
                                            company_id: companyId,
                                            conversation_id: conversationId,
                                            message_text: suggestion.response,
                                            is_from_customer: false,
                                            sent_by: null,
                                            queue_id: null
                                        });
                                    }
                                }
                            } catch (triagemErr) {
                                console.error('[IA TRIAGEM] Erro no processamento:', triagemErr.message);
                            }
                        }

                        // Se o modo for chatbot de fluxo e não tiver sido transferido pela IA
                        if (chatbotMode === 'flow' && !hasTransferred) {
                            runChatbot(text, conv || { id: conversationId, contact_phone: fromPhone }, companyId, connectionId);
                        }
                    }
                } catch (expErr) {
                    console.error('[EXPEDIENTE] Erro na validação de horário:', expErr.message);
                }
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
    if (event !== 'qrcode.updated' && event !== 'qrcode_updated' && event !== 'qr') {
        addDebugLog('WEBHOOK_EVENT', `Evento: ${event} | Instância: ${instance} | Empresa: ${companyId}`, body);
    } else {
        addDebugLog('WEBHOOK_EVENT_QR', `Evento: ${event} | Instância: ${instance} | Empresa: ${companyId} (Base64 Omitido)`);
    }

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
            const rawPhone = body?.sender || data?.user?.id || '';
            const cleanPhone = rawPhone.split('@')[0].replace(/\D/g, '');
            
            const updateData = { is_connected: true, qr_code: null, pairing_code: null };
            if (cleanPhone) {
                updateData.phone_number = cleanPhone;
                console.log(`[WEBHOOK-CONNECTION] Atualizando telefone da conexão ${connectionId} para ${cleanPhone}`);
            }
            
            await supabase.from('whatsapp_settings').update(updateData).eq('id', connectionId);
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


/**
 * Loop do Disparador de Mensagens Agendadas (Campanhas em Lote)
 */
async function processScheduledCampaigns() {
    try {
        // Função auxiliar para converter string de horário (HH:MM:SS ou HH:MM) em minutos desde a meia-noite
        const timeToMin = (tStr) => {
            if (!tStr) return 0;
            const pts = tStr.split(':');
            const h = parseInt(pts[0], 10) || 0;
            const m = parseInt(pts[1], 10) || 0;
            return h * 60 + m;
        };

        // Obter data atual em Brasília no formato YYYY-MM-DD
        const todayStr = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).split(' ')[0];
        
        // Obter a hora e minuto atuais em Brasília de forma estruturada e imune a formatações locais
        const spFormatter = new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: false
        });
        const spParts = spFormatter.formatToParts(new Date());
        const hourVal = parseInt(spParts.find(p => p.type === 'hour').value, 10);
        const minVal = parseInt(spParts.find(p => p.type === 'minute').value, 10);
        const secVal = parseInt(spParts.find(p => p.type === 'second').value, 10);
        
        const currentMinutes = hourVal * 60 + minVal;
        const currentHourStr = `${hourVal.toString().padStart(2, '0')}:${minVal.toString().padStart(2, '0')}:${secVal.toString().padStart(2, '0')}`;

        console.log(`[CAMPANHA-LOOP] Processando disparadores periódicos... Hora SP: ${currentHourStr} (${currentMinutes}m) | Data SP: ${todayStr}`);

        // 1. Obter todas as campanhas em status 'running' ou 'pending'
        const { data: campaigns, error: campErr } = await supabase
            .from('whatsapp_scheduled_campaigns')
            .select('*')
            .in('status', ['running', 'pending']);

        if (campErr) throw campErr;
        if (!campaigns || campaigns.length === 0) {
            return;
        }

        // Filtrar campanhas no Javascript para máxima robustez e compatibilidade com qualquer versão do PostgREST
        const validCampaigns = campaigns.filter(camp => {
            if (camp.status === 'running') return true;
            if (camp.status === 'pending') {
                return camp.scheduled_date <= todayStr;
            }
            return false;
        });

        if (validCampaigns.length === 0) {
            return;
        }

        for (const camp of validCampaigns) {
            // Verificar limite de horário do expediente da campanha usando minutos desde a meia-noite (100% robusto)
            const startMinutes = timeToMin(camp.start_time);
            const endMinutes = timeToMin(camp.end_time);

            if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
                console.log(`[CAMPANHA] Ignorando campanha "${camp.name}" (${camp.id}) porque está fora do horário permitido (Limites: ${camp.start_time} às ${camp.end_time} | Atual SP: ${currentHourStr}).`);
                continue;
            }

            // Verificar intervalo (interval_seconds) desde o último envio
            if (camp.last_sent_at) {
                const elapsedMs = Date.now() - new Date(camp.last_sent_at).getTime();
                if (elapsedMs < camp.interval_seconds * 1000) {
                    const remainingSec = Math.round((camp.interval_seconds * 1000 - elapsedMs) / 1000);
                    console.log(`[CAMPANHA] Aguardando intervalo de "${camp.name}" (Faltam ${remainingSec}s).`);
                    continue;
                }
            }

            console.log(`[CAMPANHA] Processando campanha ativa: "${camp.name}" (${camp.id})`);
            global.addDebugLog('CAMPANHA', `Processando campanha ativa: "${camp.name}"`, { id: camp.id, status: camp.status });

            // Se o status era 'pending', atualiza para 'running'
            if (camp.status === 'pending') {
                await supabase
                    .from('whatsapp_scheduled_campaigns')
                    .update({ status: 'running' })
                    .eq('id', camp.id);
                camp.status = 'running'; // Atualiza localmente no objeto
            }

            // 2. Buscar o próximo alvo pendente
            console.log(`[CAMPANHA] Buscando alvos pendentes para a campanha ${camp.id}...`);
            global.addDebugLog('CAMPANHA_BUSCA_ALVOS', `Buscando alvos pendentes para a campanha ${camp.name}`, { campaign_id: camp.id });

            const { data: targets, error: targetErr } = await supabase
                .from('whatsapp_scheduled_targets')
                .select('*')
                .eq('campaign_id', camp.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: true })
                .limit(1);

            if (targetErr) {
                console.error(`[CAMPANHA] Erro ao buscar alvos para campanha ${camp.id}:`, targetErr.message);
                global.addDebugLog('CAMPANHA_BUSCA_ALVOS_ERR', `Erro ao buscar alvos: ${targetErr.message}`, { error: targetErr });
                continue;
            }

            console.log(`[CAMPANHA] Busca finalizada para "${camp.name}". Alvos encontrados: ${targets ? targets.length : 0}`);
            global.addDebugLog('CAMPANHA_BUSCA_ALVOS_RES', `Busca finalizada para "${camp.name}". Alvos encontrados: ${targets ? targets.length : 0}`, { 
                targets_found: targets ? targets.length : 0 
            });

            // Se não houver mais alvos pendentes (e nenhum 'sending' em andamento), a campanha está finalizada!
            if (!targets || targets.length === 0) {
                // Verificar se há algum alvo no status 'sending' ainda sendo processado nesta campanha
                const { data: sendingTargets } = await supabase
                    .from('whatsapp_scheduled_targets')
                    .select('id')
                    .eq('campaign_id', camp.id)
                    .eq('status', 'sending')
                    .limit(1);

                if (!sendingTargets || sendingTargets.length === 0) {
                    console.log(`[CAMPANHA] Campanha "${camp.name}" finalizada com sucesso!`);
                    await supabase
                        .from('whatsapp_scheduled_campaigns')
                        .update({ status: 'completed' })
                        .eq('id', camp.id);
                }
                continue;
            }

            const target = targets[0];

            // Marcar IMEDIATAMENTE como 'sending' no banco de dados para evitar duplicidade de concorrência
            const { error: markErr } = await supabase
                .from('whatsapp_scheduled_targets')
                .update({ status: 'sending' })
                .eq('id', target.id);

            if (markErr) {
                console.error(`[CAMPANHA] Erro ao marcar alvo ${target.id} como sending:`, markErr.message);
                continue;
            }

            // 3. Obter uma conexão conectada da empresa para disparar
            const { data: connection } = await supabase
                .from('whatsapp_settings')
                .select('id, connection_name')
                .eq('company_id', camp.company_id)
                .eq('is_connected', true)
                .limit(1)
                .maybeSingle();

            if (!connection) {
                console.warn(`[CAMPANHA] Nenhuma conexão conectada para empresa da campanha ${camp.id}.`);
                await supabase
                    .from('whatsapp_scheduled_targets')
                    .update({ 
                        status: 'failed', 
                        error_message: 'Nenhum canal de WhatsApp conectado no painel',
                        sent_at: new Date().toISOString()
                    })
                    .eq('id', target.id);
                
                await supabase
                    .from('whatsapp_scheduled_campaigns')
                    .update({ last_sent_at: new Date().toISOString() })
                    .eq('id', camp.id);
                continue;
            }

            const instanceName = `conn_${connection.id}`;

            // 4. Selecionar template aleatoriamente
            const templates = [
                camp.template_1, 
                camp.template_2, 
                camp.template_3, 
                camp.template_4
            ].filter(t => t && t.trim() !== '');

            const selectedIdx = Math.floor(Math.random() * templates.length);
            const messageText = templates[selectedIdx];

            console.log(`[CAMPANHA] Disparando para ${target.contact_phone} | Template #${selectedIdx + 1}`);

            let sendSuccess = false;
            let errMsg = null;

            try {
                if (camp.image_url && camp.image_url.trim() !== '') {
                    const cleanPhone = target.contact_phone.replace(/\D/g, "");
                    
                    // Determinar mediatype ('video' ou 'image')
                    let determinedMediaType = 'image';
                    if (camp.media_type) {
                        determinedMediaType = camp.media_type;
                    } else {
                        const cleanUrl = camp.image_url.toLowerCase().split('?')[0];
                        if (cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.mov') || cleanUrl.endsWith('.avi') || cleanUrl.endsWith('.m4v') || cleanUrl.endsWith('.3gp') || cleanUrl.endsWith('.mkv') || cleanUrl.endsWith('.webm')) {
                            determinedMediaType = 'video';
                        }
                    }

                    const res = await fetch(`${evoUrl}/message/sendMedia/${instanceName}`, {
                        method: 'POST',
                        headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            number: cleanPhone,
                            mediaMessage: {
                                mediatype: determinedMediaType,
                                media: camp.image_url.trim(),
                                caption: messageText
                            }
                        })
                    });
                    
                    if (res.ok) {
                        sendSuccess = true;
                    } else {
                        const body = await res.text();
                        errMsg = `Erro no envio de mídia: HTTP ${res.status} | ${body}`;
                    }
                } else {
                    await dispatchTextEvolution(instanceName, target.contact_phone, messageText);
                    sendSuccess = true;
                }
            } catch (sendErr) {
                console.error(`[CAMPANHA] Falha no disparo:`, sendErr.message);
                errMsg = sendErr.message;
            }

            const nowIso = new Date().toISOString();
            await supabase
                .from('whatsapp_scheduled_targets')
                .update({
                    status: sendSuccess ? 'sent' : 'failed',
                    selected_template_index: selectedIdx + 1,
                    sent_at: nowIso,
                    error_message: errMsg
                })
                .eq('id', target.id);

            await supabase
                .from('whatsapp_scheduled_campaigns')
                .update({ last_sent_at: nowIso })
                .eq('id', camp.id);

            // Inserir no histórico se conversa existir
            try {
                const { data: existingConv } = await supabase
                    .from('whatsapp_conversations')
                    .select('id')
                    .eq('company_id', camp.company_id)
                    .eq('contact_phone', target.contact_phone)
                    .maybeSingle();

                if (existingConv) {
                    await supabase.from('whatsapp_messages').insert({
                        company_id: camp.company_id,
                        conversation_id: existingConv.id,
                        message_text: camp.image_url ? `[Imagem Agendada] ${messageText}` : messageText,
                        is_from_customer: false,
                        sent_by: null
                    });
                }
            } catch (histErr) {
                console.warn('[CAMPANHA-HISTORICO] Erro ao gravar histórico:', histErr.message);
            }
        }
    } catch (err) {
        console.error('[CAMPANHA-LOOP] Erro fatal:', err.message);
    }
}

// Iniciar o loop de disparos a cada 15 segundos
setInterval(processScheduledCampaigns, 15000);


app.get('/debug-db', async (req, res) => {
    try {
        const results = {};
        
        // 1. Verificar colunas de whatsapp_quick_messages
        try {
            const { data: qmCols, error: qmErr } = await supabase.rpc('exec_sql', {
                sql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'whatsapp_quick_messages';"
            });
            results.whatsapp_quick_messages_columns = qmCols || { error: qmErr?.message };
        } catch (e) {
            results.whatsapp_quick_messages_columns = { error: e.message };
        }

        // 2. Verificar colunas de whatsapp_scheduled_campaigns
        try {
            const { data: scCols, error: scErr } = await supabase.rpc('exec_sql', {
                sql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'whatsapp_scheduled_campaigns';"
            });
            results.whatsapp_scheduled_campaigns_columns = scCols || { error: scErr?.message };
        } catch (e) {
            results.whatsapp_scheduled_campaigns_columns = { error: e.message };
        }

        // 3. Verificar hora atual do banco
        try {
            const { data: timeData, error: timeErr } = await supabase.rpc('exec_sql', {
                sql: "SELECT NOW() as pg_now, CURRENT_TIME as pg_time, timezone('America/Sao_Paulo', NOW()) as sp_now;"
            });
            results.db_time = timeData || { error: timeErr?.message };
        } catch (e) {
            results.db_time = { error: e.message };
        }

        // 4. Verificar hora atual do Node na VPS
        results.node_time = {
            now: new Date().toISOString(),
            sp_now: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        };

        // 5. Verificar campanhas cadastradas e seus status
        const { data: campaigns } = await supabase.from('whatsapp_scheduled_campaigns').select('*');
        results.campaigns = campaigns;

        // 6. Verificar alvos (amostra)
        const { data: targets } = await supabase.from('whatsapp_scheduled_targets').select('id, campaign_id, status, error_message, sent_at').limit(20);
        results.targets_sample = targets;

        // 7. Retornar os últimos logs em memória
        results.debug_logs = global.debugLogs;

        return res.json(results);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
  console.log(`🚀 Servidor WhatsPanda (Evolution Proxy) rodando na porta ${port}`);
});
