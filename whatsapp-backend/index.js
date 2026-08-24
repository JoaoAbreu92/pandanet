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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey.trim());

// --- JWT Auth Middleware ---
async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('[auth] WhatsApp: Missing or invalid Authorization header');
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.split(' ')[1];

  // Strategy 1: Verify via Supabase auth.getUser (preferred)
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) {
      req.user = user;
      return next();
    }
    console.warn('[auth] Supabase getUser failed, trying JWT fallback:', error?.message);
  } catch (err) {
    console.warn('[auth] Supabase getUser threw error, trying JWT fallback:', err.message);
  }

  // Strategy 2: Direct JWT verification using JWT_SECRET (fallback)
  if (JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      // Supabase access tokens have a 'sub' (user ID) claim
      if (decoded && (decoded.sub || decoded.role)) {
        console.log('[auth] JWT verified via secret fallback. Role:', decoded.role, 'Sub:', decoded.sub);
        req.user = { id: decoded.sub, role: decoded.role, email: decoded.email };
        return next();
      }
    } catch (jwtErr) {
      console.error('[auth] JWT secret fallback also failed:', jwtErr.message);
    }
  }

  return res.status(401).json({ error: 'Invalid or expired token' });
}

app.get('/health', (req, res) => res.json({ status: 'ok', secret_loaded: !!JWT_SECRET }));

// TEMPORARY: One-time database fix endpoint - REMOVE AFTER USE
app.post('/admin/apply-sql-fix', async (req, res) => {
  const adminSecret = req.headers['x-admin-secret'];
  if (!adminSecret || adminSecret !== (JWT_SECRET || 'pandanet-admin-2026')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { Client } = require('pg');
  const dbUrl = process.env.DATABASE_URL || `postgresql://postgres:postgres@supabase-db:5432/postgres`;
  
  const client = new Client({ connectionString: dbUrl, connectionTimeoutMillis: 10000 });
  
  try {
    await client.connect();
    
    const sql = `
DROP FUNCTION IF EXISTS public.create_user_admin(TEXT, TEXT, TEXT, UUID, TEXT, BOOLEAN, BOOLEAN);

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.create_user_admin(
    p_email TEXT,
    p_password TEXT DEFAULT 'PandaNet123!',
    p_full_name TEXT DEFAULT 'Novo Usuário',
    p_role TEXT DEFAULT 'Employee',
    p_team TEXT DEFAULT 'Geral',
    p_company_id UUID DEFAULT NULL,
    p_is_admin BOOLEAN DEFAULT FALSE,
    p_is_company_admin BOOLEAN DEFAULT FALSE,
    p_permissions JSONB DEFAULT '{}'::jsonb,
    p_avatar_url TEXT DEFAULT NULL,
    p_department_id UUID DEFAULT NULL,
    p_rg TEXT DEFAULT NULL,
    p_cpf TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_new_user_id UUID;
    v_encrypted_pw TEXT;
BEGIN
    v_new_user_id := gen_random_uuid();
    v_encrypted_pw := crypt(COALESCE(p_password, 'PandaNet123!'), gen_salt('bf'));
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
    VALUES (v_new_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, v_encrypted_pw, now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', p_full_name), now(), now(), encode(gen_random_bytes(32), 'hex'), encode(gen_random_bytes(32), 'hex'));
    INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id)
    VALUES (gen_random_uuid(), v_new_user_id, jsonb_build_object('sub', v_new_user_id::text, 'email', p_email), 'email', now(), now(), now(), v_new_user_id::text);
    INSERT INTO public.profiles (id, email, full_name, role, team, company_id, is_admin, is_company_admin, permissions, avatar_url, department_id, rg, cpf, status, created_at, updated_at)
    VALUES (v_new_user_id, p_email, p_full_name, p_role, p_team, p_company_id, p_is_admin, p_is_company_admin, p_permissions, p_avatar_url, p_department_id, p_rg, p_cpf, 'active', now(), now());
    RETURN v_new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_user_admin(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN, JSONB, TEXT, UUID, TEXT, TEXT) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
    `;
    
    await client.query(sql);
    await client.end();
    console.log('[ADMIN] SQL fix applied successfully');
    res.json({ success: true, message: 'SQL fix applied. Please remove this endpoint from the code.' });
  } catch (err) {
    try { await client.end(); } catch {}
    console.error('[ADMIN] SQL fix failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});


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
