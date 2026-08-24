# Script para rebuild do backend WhatsApp
Write-Host "🔄 Conectando na VPS e fazendo rebuild do backend..." -ForegroundColor Cyan

$commands = @"
cd /root/pandanet && \
git pull origin main && \
docker-compose -f docker-compose.prod.yml build --no-cache whatsapp_backend_prod && \
docker-compose -f docker-compose.prod.yml up -d whatsapp_backend_prod && \
echo '✅ Rebuild completo!' && \
sleep 5 && \
docker logs whatsapp_backend_prod --tail 50
"@

ssh root@172.19.0.3 $commands

Write-Host "`n✅ Processo concluído!" -ForegroundColor Green
