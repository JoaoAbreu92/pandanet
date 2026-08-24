# Script de Deploy Automático para PandaNet (Windows PowerShell)

Write-Host "🚀 Iniciando deploy automático do PandaNet..." -ForegroundColor Cyan

# 1. Verificar se há alterações não commitadas
$status = git status --porcelain
if ($status) {
    Write-Host "⚠️ Existem alterações pendentes. Commitando alterações automaticamente..." -ForegroundColor Yellow
    git add .
    git commit -m "chore: atualizações automáticas de desenvolvimento"
}

# 2. Enviar alterações para o GitHub
Write-Host "📤 Enviando alterações para o GitHub..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Error "Erro ao enviar código para o GitHub."
    exit 1
}

# 3. Conectar à VPS e rodar atualização
Write-Host "🌐 Conectando à VPS (77.37.43.60) e executando atualização..." -ForegroundColor Yellow
ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@77.37.43.60 "cd ~/pandanet && chmod +x update_pandanet.sh && ./update_pandanet.sh"

if ($LASTEXITCODE -ne 0) {
    Write-Warning "⚠️ Deploy automático falhou. Verifique se o SSH sem senha (chave pública) está configurado."
    exit 1
}

Write-Host "✨ Deploy concluído com sucesso na VPS!" -ForegroundColor Green
