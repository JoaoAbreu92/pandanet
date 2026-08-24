#!/bin/bash

echo "=== DIAGNOSTICO DE BANCO DE DADOS INTRA-CONVERSAS ==="

# 1. Encontrar o container do banco de dados
CONTAINER_ID=$(docker ps --filter "name=db" -q | head -n 1)

if [ -z "$CONTAINER_ID" ]; then
  # Tentar buscar por postgres ou supabase
  CONTAINER_ID=$(docker ps --filter "name=postgres" -q | head -n 1)
fi

if [ -z "$CONTAINER_ID" ]; then
  echo "Erro: Container do banco de dados do Supabase nao encontrado pelo docker ps."
  exit 1
fi

echo "Container do banco de dados detectado: $CONTAINER_ID"

echo -e "\n--- PERFIS DE PRODUCAO ---"
docker exec -t $CONTAINER_ID psql -U postgres -d postgres -c "SELECT id, email, full_name, company_id FROM profiles WHERE email = 'ti@grupopixel.com.br' OR email = 'financeiro@grupopixel.com.br';"

echo -e "\n--- DETALHES DE TODAS AS CONVERSAS 1:1 ---"
docker exec -t $CONTAINER_ID psql -U postgres -d postgres -c "SELECT id, company_id, is_group, is_closed, last_message, created_by FROM conversations WHERE is_group = false;"

echo -e "\n--- PARTICIPANTES DE CONVERSAS 1:1 ---"
docker exec -t $CONTAINER_ID psql -U postgres -d postgres -c "SELECT cp.conversation_id, cp.user_id, p.email, p.full_name, cp.company_id FROM conversation_participants cp JOIN profiles p ON cp.user_id = p.id;"

echo -e "\n--- ULTIMAS MENSAGENS ENVIADAS ---"
docker exec -t $CONTAINER_ID psql -U postgres -d postgres -c "SELECT m.id, m.conversation_id, p.email, m.text, m.created_at FROM messages m JOIN profiles p ON m.sender_id = p.id ORDER BY m.created_at DESC LIMIT 10;"
