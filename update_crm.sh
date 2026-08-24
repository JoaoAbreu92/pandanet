#!/bin/bash

# Script para atualizar APENAS o Perfex CRM (Ayla)
# Evita reconstruir o PandaNet inteiro sem necessidade.

echo "🔄 Iniciando atualização do Ayla CRM..."

# 1. Puxar alterações do Git
echo "⏬ Baixando código mais recente..."
git fetch origin && git reset --hard origin/main

# 2. Reconstruir apenas os containers do Perfex
echo "🚀 Reiniciando apenas o Ayla CRM..."
docker compose -f docker-compose.perfex.yml down
docker compose -f docker-compose.perfex.yml up -d --build

# 3. Aplicar permissões de novo para garantir (caso o Git mude algo)
echo "🔐 Ajustando permissões da pasta de dados..."
chmod -R 755 perfex-data/app

echo "✅ Atualização do CRM concluída!"
docker ps | grep perfex
