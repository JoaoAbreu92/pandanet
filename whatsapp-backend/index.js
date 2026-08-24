const express = require('express');
const cors = require('cors');
const { connectToWhatsApp, sessions, updateCompanySettings } = require('./whatsapp');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.get('/', (req, res) => {
  res.send('WhatsPanda Backend Rodando 🐼 (Multi-Inquilino)');
});

// Endpoint para iniciar sessão manualmente (ex: nova empresa cadastrada)
app.post('/sessions/:companyId/start', async (req, res) => {
  const { companyId } = req.params;
  if (sessions.has(companyId)) {
    return res.status(400).json({ status: 'error', message: 'Sessão já existe para esta empresa.' });
  }
  try {
    await connectToWhatsApp(companyId);
    res.json({ status: 'success', message: `Iniciando sessão para empresa ${companyId}` });
  } catch (error) {
    console.error('Erro ao iniciar sessão:', error);
    res.status(500).json({ status: 'error', message: 'Falha ao iniciar sessão' });
  }
});

// Endpoint para parar sessão
app.post('/sessions/:companyId/stop', async (req, res) => {
  const { companyId } = req.params;
  const sock = sessions.get(companyId);
  if (sock) {
    sock.end(undefined); // Encerra conexão
    sessions.delete(companyId);
    await updateCompanySettings(companyId, { is_connected: false });
    res.json({ status: 'success', message: `Sessão encerrada para empresa ${companyId}` });
  } else {
    res.status(404).json({ status: 'error', message: 'Sessão não encontrada.' });
  }
});

// Endpoint verificar status
app.get('/sessions/:companyId/status', (req, res) => {
  const { companyId } = req.params;
  const isConnected = sessions.has(companyId);
  res.json({ companyId, isConnected });
});

// Inicialização: Carregar todas as empresas que têm configurações
async function startAllSessions() {
  console.log('🔄 Buscando empresas para iniciar sessões WhatsApp...');
  const { data: settings, error } = await supabase
    .from('whatsapp_settings')
    .select('company_id');

  if (error) {
    console.error('❌ Erro ao buscar configurações:', error);
    return;
  }

  if (settings && settings.length > 0) {
    console.log(`✅ Encontradas ${settings.length} empresas. Iniciando conexões...`);
    for (const config of settings) {
      connectToWhatsApp(config.company_id).catch(err =>
        console.error(`❌ Erro ao conectar empresa ${config.company_id}:`, err)
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
