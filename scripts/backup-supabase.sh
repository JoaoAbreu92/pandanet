#!/bin/bash

# Script de Backup Automático do Supabase
# Autor: PandaNet Setup
# Descrição: Faz backup do banco de dados PostgreSQL do Supabase

BACKUP_DIR=~/backups
DATE=$(date +%Y%m%d_%H%M%S)

# Criar diretório de backup se não existir
mkdir -p $BACKUP_DIR

echo "Iniciando backup do Supabase..."

# Backup do PostgreSQL
docker exec supabase-db pg_dumpall -U postgres > $BACKUP_DIR/supabase_$DATE.sql

if [ $? -eq 0 ]; then
    echo "✓ Backup concluído com sucesso: $BACKUP_DIR/supabase_$DATE.sql"
    
    # Comprimir backup
    gzip $BACKUP_DIR/supabase_$DATE.sql
    echo "✓ Backup comprimido: $BACKUP_DIR/supabase_$DATE.sql.gz"
    
    # Manter apenas últimos 7 backups
    find $BACKUP_DIR -name "supabase_*.sql.gz" -mtime +7 -delete
    echo "✓ Backups antigos removidos (mantidos últimos 7 dias)"
else
    echo "✗ Erro ao fazer backup!"
    exit 1
fi

# Mostrar tamanho do backup
du -h $BACKUP_DIR/supabase_$DATE.sql.gz
