#!/bin/bash
# Script MESTRE de Atualização da VPS

echo "🚀 Iniciando atualização do PandaNet..."

# 1. Puxar alterações do Git
echo "⬇️  Baixando código mais recente..."
git pull origin main

# 2. Reconstruir Frontend/Backend Docker
echo "🐳 Reconstruindo containers Docker..."
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build

# 3. Reiniciar Serviço de E-mail (Node.js separado)
echo "📧 Reiniciando serviço de e-mail..."
chmod +x run_email_service.sh
./run_email_service.sh

echo "✨ Atualização concluída com SUCESSO! ✨"
