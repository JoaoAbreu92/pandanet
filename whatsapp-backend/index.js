const express = require('express');
const cors = require('cors');
const { connectToWhatsApp, sessions, updateCompanySettings } = require('./whatsapp');
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
const JWT_SECRET = process.env.JWT_SECRET || 'HUbsX+bnpLkNSSNfeV3uq3HgtaCvl0YHOSwtDML3tmc';

// --- Security Middlewares ---
app.use(helmet());
app.use(hpp());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente em 15 minutos.' }
});

app.use(limiter);
app.use(cors({ origin: '*' }));
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey.trim());

// --- JWT Auth Middleware ---
async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('[auth] WhatsApp: Missing or invalid Authorization header.');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    // 1. Try Supabase verify first (this might fail if internal kong URL is unreachable from node)
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.warn(`[auth] Supabase Auth fail: ${error?.message || 'No user'}. Trying direct JWT verify...`);
      // 2. Fallback: Verify JWT signature directly with JWT_SECRET (bypasses network issues)
      if (!JWT_SECRET) {
        return res.status(401).json({ error: 'Server misconfigured: Missing JWT_SECRET', detail: error?.message });
      }
      
      const decodedUser = jwt.verify(token, JWT_SECRET);
      // Construct a minimal user object matching Supabase's format
      req.user = { id: decodedUser.sub, email: decodedUser.email, role: decodedUser.role };
      console.log(`[auth] Verified token manually for user ${req.user.id}`);
      return next();
    }

    req.user = user;
    next();
  } catch (error) {
    console.error(`[auth] JWT Verify fail: ${error.message}`, error);
    return res.status(401).json({ 
      error: 'Invalid or expired token', 
      reason: error.message,
      secret_available: !!JWT_SECRET,
      token_preview: token.substring(0, 15) + '...'
    });
  }
}
app.get('/health', (req, res) => res.json({ status: 'ok', secret_loaded: !!JWT_SECRET }));

app.get('/', (req, res) => {
  res.send('WhatsPanda Backend Rodando 🐼 (Multi-Inquilino)');
});

// Endpoint para iniciar sessão manualmente
app.post('/sessions/:companyId/start/:connectionId', authMiddleware, async (req, res) => {
  const { companyId, connectionId } = req.params;
  console.log(`[POST] /sessions/${companyId}/start/${connectionId} - Recebido`);

  // Se já existe uma sessão, vamos tentar fechá-la antes de iniciar uma nova
  // Isso ajuda a destravar sessões que ficaram em estado 'connecting' ou 'stale'
  if (sessions.has(connectionId)) {
    console.log(`[RESTART] Encerrando sessão existente para ${connectionId} antes de reiniciar...`);
    try {
      const oldSock = sessions.get(connectionId);
      if (oldSock && typeof oldSock.end === 'function') {
        oldSock.ev.removeAllListeners();
        oldSock.end(undefined);
      }
    } catch (e) {
      console.warn(`[RESTART] Erro ao fechar sessão antiga:`, e.message);
    }
    sessions.delete(connectionId);
  }

  try {
    // Limpa qualquer timer de timeout anterior
    if (sessions.has(connectionId + '_timer')) {
      clearTimeout(sessions.get(connectionId + '_timer'));
      sessions.delete(connectionId + '_timer');
    }

    await connectToWhatsApp(companyId, connectionId);
    res.json({ status: 'success', message: `Iniciando sessão para conexão ${connectionId}` });
    console.log(`[SUCCESS] Comando de início enviado para ${connectionId}`);
  } catch (error) {
    console.error('Erro ao iniciar sessão:', error);
    res.status(500).json({ status: 'error', message: 'Falha ao iniciar sessão' });
  }
});

// Endpoint para parar sessão
app.post('/sessions/:companyId/stop/:connectionId', authMiddleware, async (req, res) => {
  const { companyId, connectionId } = req.params;
  const sock = sessions.get(connectionId);
  if (sock) {
    sock.end(undefined); // Encerra conexão
    sessions.delete(connectionId);
    await updateCompanySettings(connectionId, { is_connected: false });
    res.json({ status: 'success', message: `Sessão encerrada para conexão ${connectionId}` });
  } else {
    res.status(404).json({ status: 'error', message: 'Sessão não encontrada.' });
  }
});

// Endpoint verificar status
app.get('/sessions/:companyId/status/:connectionId', (req, res) => {
  const { companyId, connectionId } = req.params;
  const isConnected = sessions.has(connectionId);
  res.json({ companyId, connectionId, isConnected });
});

// Endpoint para listar TODAS as sessões ativas (SaaS Dashboard)
app.get('/sessions/status/all', authMiddleware, (req, res) => {
  const activeSessions = Array.from(sessions.keys());
  res.json({ count: activeSessions.length, activeConnectionIds: activeSessions });
});

// Inicialização: Carregar todas as conexões WhatsApp
async function startAllSessions() {
  console.log('🔄 Buscando conexões para iniciar sessões WhatsApp...');
  const { data: settings, error } = await supabase
    .from('whatsapp_settings')
    .select('id, company_id')
    .eq('channel_type', 'whatsapp');

  if (error) {
    console.error('❌ Erro ao buscar configurações:', error);
    return;
  }

  if (settings && settings.length > 0) {
    console.log(`✅ Encontradas ${settings.length} conexões WhatsApp. Iniciando...`);
    for (const config of settings) {
      connectToWhatsApp(config.company_id, config.id).catch(err =>
        console.error(`❌ Erro ao conectar conexão ${config.id}:`, err)
      );
    }
  } else {
    console.log('ℹ️ Nenhuma configuração de WhatsApp encontrada para iniciar.');
  }
}

app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
  startAllSessions();
});
