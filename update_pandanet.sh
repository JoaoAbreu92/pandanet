#!/bin/bash

# Script para atualizar APENAS a PandaNet (Frontend e Backends)
# Não afeta o Perfex CRM (Ayla).

echo "🔄 Iniciando atualização da PandaNet..."

# 1. Puxar alterações do Git
echo "⏬ Baixando código mais recente..."
git fetch origin && git reset --hard origin/main

# 2. Reconstruir apenas os containers da PandaNet
# Usamos o arquivo production que contém os serviços core
echo "🚀 Reiniciando apenas a PandaNet..."
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d --build

# 3. Limpeza rápida
docker image prune -f

echo "✅ Atualização da PandaNet concluída!"
docker ps | grep pandanet
