#!/bin/bash

# Criar estrutura de pastas para o Perfex CRM
mkdir -p perfex-data/db
mkdir -p perfex-data/app

# Ajustar permissões
chmod -R 777 perfex-data/db
chmod -R 777 perfex-data/app

echo "Estrutura de pastas para o Perfex CRM criada com sucesso!"
echo "Lembre-se de subir os arquivos do Perfex para a pasta perfex-data/app antes de subir o container."
