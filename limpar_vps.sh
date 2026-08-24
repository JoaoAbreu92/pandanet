#!/bin/bash

# Script de Limpeza Profunda para VPS
# Recupera espaço ocupado por caches do Docker, logs gigantes e pacotes antigos do sistema de forma segura.

echo "🧹 Iniciando Limpeza Profunda na VPS..."

# 1. Exibir espaço em disco antes da limpeza
echo "----------------------------------------"
echo "📊 Espaço em disco ANTES da limpeza:"
df -h /
echo "----------------------------------------"

# 2. Limpar cache do Docker Builder (BuildKit)
# O Docker armazena cache de todas as etapas de build que foram feitas. 
# Ao reconstruir containers repetidas vezes, isso facilmente acumula dezenas de GBs de lixo.
echo "🐳 1. Limpando cache de compilação do Docker (BuildKit)..."
docker builder prune -a -f

# 3. Limpar containers parados, redes não utilizadas e imagens suspensas (dangling)
echo "🐳 2. Executando limpeza geral de recursos parados no Docker..."
docker system prune -f

# 4. Limpar imagens antigas não utilizadas por nenhum container ativo
echo "🐳 3. Removendo imagens antigas/redundantes do Docker..."
docker image prune -a -f

# 5. Limpar os arquivos de logs acumulados do Docker
# O Docker gera logs contínuos que crescem sem parar. Esse comando esvazia os logs de forma segura
# sem precisar parar ou reiniciar os containers ativos.
echo "📝 4. Esvaziando arquivos de logs acumulados do Docker..."
find /var/lib/docker/containers/ -type f -name "*.log" -exec truncate -s 0 {} \; 2>/dev/null || true

# 6. Limpeza do sistema operacional (APT cache e pacotes órfãos)
if [ -f /usr/bin/apt-get ]; then
    echo "📦 5. Limpando cache de pacotes do sistema (Ubuntu/Debian)..."
    sudo apt-get autoremove -y
    sudo apt-get clean
fi

# 7. Reduzir logs do sistema do Systemd (Journald)
if command -v journalctl >/dev/null 2>&1; then
    echo "📓 6. Reduzindo logs do Journald para no máximo 100MB..."
    sudo journalctl --vacuum-size=100M
fi

# 8. Exibir espaço em disco depois da limpeza
echo "----------------------------------------"
echo "📊 Espaço em disco DEPOIS da limpeza:"
df -h /
echo "----------------------------------------"

echo "✅ Limpeza profunda concluída!"
