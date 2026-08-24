#!/bin/bash

echo "🔄 Iniciando atualização da PandaNet..."

# 1. Puxar alterações do GitHub
echo "⏬ Baixando código mais recente..."
git pull origin main

# 2. Descer os containers ativos e remover órfãos
echo "🧹 Limpando containers antigos..."
docker compose -f docker-compose.production.yml down --remove-orphans

# 3. Subir e reconstruir usando as configurações oficiais
echo "🚀 Reconstruindo e iniciando o sistema..."
docker compose -f docker-compose.production.yml up -d --build

# 4. Aguardar o banco estar acessível (com retry)
echo "🗄️ Aguardando o banco de dados ficar pronto..."
MAX_RETRIES=12
RETRY_COUNT=0
until docker exec supabase-db psql -U postgres -d postgres -c '\q' 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ Banco não ficou pronto após ${MAX_RETRIES} tentativas. Aplicando SQL assim mesmo..."
    break
  fi
  echo "  Aguardando DB... (tentativa $RETRY_COUNT/$MAX_RETRIES)"
  sleep 5
done

# 5. Aplicar correções de banco de dados (RPCs, agent_id, etc.)
echo "🗄️ Aplicando correções de banco de dados na VPS..."
docker exec -i supabase-db psql -U supabase_admin -d postgres < supabase/vps_fix_2026.sql
if [ $? -eq 0 ]; then
    echo "✅ Correções de banco aplicadas com sucesso!"
else
    echo "⚠️ Aviso: Algumas correções de banco podem ter falhado (verifique os logs acima)."
fi

# 6. Atualizar Frontend (Build React/Vite)
echo "📦 Construindo Frontend..."
npm install
npm run build

# 7. Atualizar e reiniciar processos do PM2
echo "🔄 Reiniciando processos PM2..."
pm2 restart all --update-env

# 8. Limpeza profunda da VPS
echo "🧹 Executando limpeza profunda da VPS..."
chmod +x limpar_vps.sh
./limpar_vps.sh

echo "✅ Atualização concluída com sucesso!"
docker ps | grep -E "pandanet|supabase"
