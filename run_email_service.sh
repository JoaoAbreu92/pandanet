#!/bin/bash
# Script para rodar o serviço de e-mail em background (Modo Produção)

echo "--- Iniciando Serviço de E-mail PandaNet ---"

# 1. Tenta parar uma instância anterior (se houver)
pkill -f "email-handler/index.ts"
echo "Processos anteriores encerrados."

# 2. Roda o Deno em background (nohup)
# - Usa caminho absoluto do Deno (/root/.deno/bin/deno)
# - Flags de permissão necessárias
# - Salva logs em email-service.log
# - Executa em background (&)

nohup /root/.deno/bin/deno run --allow-net --allow-env --allow-sys --watch supabase/functions/email-handler/index.ts > email-service.log 2>&1 &

echo "✅ Serviço iniciado com SUCESSO na porta 9999!"
echo "📝 Logs estão sendo salvos em: email-service.log"
echo "OBS: Você pode fechar este terminal que o serviço continuará rodando."
