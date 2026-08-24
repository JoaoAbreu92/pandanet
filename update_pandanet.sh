#!/bin/bash

# Script para atualizar APENAS a PandaNet (Frontend e Backends)

echo "🔄 Iniciando atualização da PandaNet..."

# 1. Puxar alterações do Git
echo "⏬ Baixando código mais recente..."
git fetch origin && git reset --hard origin/main

# 2. Reconstruir apenas os containers da PandaNet
# Usamos o arquivo production que contém os serviços core
echo "🚀 Reiniciando apenas a PandaNet..."
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d --build

# 2.5 Rodar correção de RLS e reabertura de chats
echo "🔧 Aplicando correções RLS no banco de dados..."
chmod +x scratch/apply_rls.sh
./scratch/apply_rls.sh

# 3. Limpeza profunda da VPS
echo "🧹 Executando limpeza profunda da VPS..."
chmod +x limpar_vps.sh
./limpar_vps.sh

echo "✅ Atualização da PandaNet concluída!"
docker ps | grep pandanet

