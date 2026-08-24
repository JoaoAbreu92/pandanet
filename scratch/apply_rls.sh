#!/bin/bash
echo "=== APLICANDO CORREÇÕES DE RLS NO BANCO DE DADOS ==="

# 1. Encontrar o container do banco de dados
CONTAINER_ID=$(docker ps --filter "name=supabase-db" -q | head -n 1)
if [ -z "$CONTAINER_ID" ]; then
  CONTAINER_ID=$(docker ps --filter "name=db-intranet" -q | head -n 1)
fi
if [ -z "$CONTAINER_ID" ]; then
  CONTAINER_ID=$(docker ps --filter "name=db" -q | head -n 1)
fi
if [ -z "$CONTAINER_ID" ]; then
  CONTAINER_ID=$(docker ps --filter "name=postgres" -q | head -n 1)
fi

if [ -z "$CONTAINER_ID" ]; then
  echo "Erro: Container do postgres/db não encontrado."
  exit 1
fi

echo "Container encontrado: $CONTAINER_ID"

# 2. Encontrar o caminho do psql no container
PSQL_PATH=$(docker exec $CONTAINER_ID which psql 2>/dev/null | tr -d '\r')
if [ -z "$PSQL_PATH" ]; then
  PSQL_PATH=$(docker exec $CONTAINER_ID find / -name psql 2>/dev/null | head -n 1 | tr -d '\r')
fi

if [ -z "$PSQL_PATH" ]; then
  echo "Erro: psql não encontrado no container."
  exit 1
fi

echo "Caminho do psql no container: $PSQL_PATH"

# 3. Executar o SQL do arquivo vps_fix_2026.sql diretamente (evita erros de escape e bash parser)
echo "Executando SQL a partir de supabase/vps_fix_2026.sql..."
docker exec -i $CONTAINER_ID $PSQL_PATH -U postgres -d postgres < supabase/vps_fix_2026.sql

if [ $? -eq 0 ]; then
    echo "=== CONCLUÍDO COM SUCESSO ==="
else
    echo "=== ERRO NA EXECUÇÃO DO SQL ==="
    exit 1
fi
