#!/bin/bash
# Script para rodar o serviço de e-mail em background (Versão Node.js)

echo "--- Iniciando Serviço de E-mail PandaNet (Node.js) ---"

# 1. Para processo anterior
pkill -f "email-server.js"
sleep 2
echo "Processos anteriores encerrados."

# 2. Atualiza dependências
cd server
npm install 
cd ..

# 3. Roda Node em background
# - Logs em email-server.log
# Carrega veriáveis de ambiente
if [ -f .env ]; then
  export $(cat .env | xargs)
elif [ -f .env.production ]; then
  export $(cat .env.production | xargs)
fi

# 3. Roda Node em background
# - Logs em email-server.log
nohup node server/email-server.js > email-service.log 2>&1 &

echo "✅ Serviço Node.js iniciado na porta 3001!"
echo "📝 Logs em: email-service.log"
