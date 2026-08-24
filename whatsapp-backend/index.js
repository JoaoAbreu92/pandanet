const express = require('express');
const cors = require('cors');
const { connectToWhatsApp, sessions, updateCompanySettings } = require('./whatsapp');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

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

// --- JWT Auth Middleware ---
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  try {
    if (!JWT_SECRET) throw new Error('JWT_SECRET not configured');
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.get('/', (req, res) => {
  res.send('WhatsPanda Backend Rodando 🐼 (Multi-Inquilino)');
});

// Endpoint para iniciar sessão manualmente
app.post('/sessions/:companyId/start/:connectionId', authMiddleware, async (req, res) => {
  const { companyId, connectionId } = req.params;
  console.log(`[POST] /sessions/${companyId}/start/${connectionId} - Recebido`); // Log de entrada
  if (sessions.has(connectionId)) {
    return res.status(400).json({ status: 'error', message: 'Sessão já existe para esta conexão.' });
  }
  try {
    await connectToWhatsApp(companyId, connectionId);
    res.json({ status: 'success', message: `Iniciando sessão para conexão ${connectionId}` });
    console.log(`[SUCCESS] Sessão iniciada para ${connectionId}`);
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
