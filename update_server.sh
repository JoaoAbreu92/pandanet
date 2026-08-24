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

# 4. Aplicar correções de banco de dados (Ex: agent_id, RPCs)
echo "🗄️ Aplicando correções de banco de dados na VPS..."
# Aguarda o banco subir se necessário
sleep 5
docker exec -i supabase-db psql -U postgres -d postgres < supabase/vps_fix_2026.sql

# 5. Atualizar e reiniciar processos do PM2
echo "🔄 Reiniciando processos PM2..."
pm2 restart all --update-env

echo "✅ Atualização concluída com sucesso!"
docker ps | grep pandanet
