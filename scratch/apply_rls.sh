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

# 3. Executar o SQL
SQL_COMMANDS="
-- Habilitar política de atualização para mensagens
DROP POLICY IF EXISTS \"Users can update messages\" ON messages;
CREATE POLICY \"Users can update messages\" ON messages 
FOR UPDATE TO authenticated 
USING (conversation_id IN (SELECT get_safe_conversation_ids()))
WITH CHECK (true);

-- Habilitar política de atualização para conversas
DROP POLICY IF EXISTS \"Users can update conversations\" ON conversations;
CREATE POLICY \"Users can update conversations\" ON conversations 
FOR UPDATE TO authenticated 
USING (id IN (SELECT get_safe_conversation_ids()))
WITH CHECK (true);

-- Reabrir conversas internas (mesma empresa) que estejam fechadas
UPDATE conversations SET is_closed = false 
WHERE id IN (
  SELECT c.id FROM conversations c 
  JOIN conversation_participants cp1 ON c.id = cp1.conversation_id 
  JOIN conversation_participants cp2 ON c.id = cp2.conversation_id 
  JOIN profiles p1 ON cp1.user_id = p1.id 
  JOIN profiles p2 ON cp2.user_id = p2.id 
  WHERE c.is_group = false 
    AND p1.company_id = p2.company_id 
    AND p1.id != p2.id
);
"

echo "Executando SQL..."
docker exec -i $CONTAINER_ID $PSQL_PATH -U postgres -d postgres -c "$SQL_COMMANDS"

echo "=== CONCLUÍDO ==="
