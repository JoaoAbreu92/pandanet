#!/bin/bash
# Script MESTRE de Atualização da VPS

echo "🚀 Iniciando atualização do PandaNet..."

# 1. Puxar alterações do Git
echo "⬇️  Baixando código mais recente..."
git pull origin main

# 2. Reconstruir Frontend/Backend Docker
echo "🐳 Reconstruindo containers Docker..."

# Verifica se existe arquivo .env e o usa
if [ -f .env ]; then
    echo "📄 Usando arquivo .env para variáveis de ambiente..."
    OPTS="--env-file .env"
elif [ -f .env.production ]; then
    echo "📄 Usando arquivo .env.production para variáveis de ambiente..."
    OPTS="--env-file .env.production"
else
    echo "⚠️  AVISO: Nenhum arquivo .env encontrado. As variáveis devem estar no sistema!"
    OPTS=""
fi

docker compose $OPTS -f docker-compose.prod.yml down
docker compose $OPTS -f docker-compose.prod.yml up -d --build

# 3. Reiniciar Serviço de E-mail (Node.js separado)
echo "📧 Reiniciando serviço de e-mail..."
chmod +x run_email_service.sh
./run_email_service.sh

# 4. Limpeza profunda da VPS
echo "🧹 Executando limpeza profunda da VPS..."
chmod +x limpar_vps.sh
./limpar_vps.sh

echo "✨ Atualização concluída com SUCESSO! ✨"
