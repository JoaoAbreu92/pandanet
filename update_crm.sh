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

# 3. Ajustar permissões da pasta de dados (Imprescindível para o instalador)
echo "🔐 Ajustando permissões para o instalador..."
# Dar permissão total para as pastas que o Perfex precisa escrever
chmod -R 777 perfex-data/app/uploads
chmod -R 777 perfex-data/app/application/config
chmod -R 777 perfex-data/app/temp
# Garante que o usuário do Apache (33) seja o dono
chown -R 33:33 perfex-data/app/uploads
chown -R 33:33 perfex-data/app/application/config
chown -R 33:33 perfex-data/app/temp

echo "✅ Atualização do CRM concluída!"
docker ps | grep perfex
