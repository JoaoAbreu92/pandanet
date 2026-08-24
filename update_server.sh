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

echo "✅ Atualização concluída com sucesso!"
docker ps | grep pandanet
