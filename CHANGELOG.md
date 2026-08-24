# CHANGELOG - PandaNet

Documento de registro de todas as alterações notáveis feitas no projeto PandaNet.

## [1.1.2-beta] - 2026-04-06

Esta versão marca uma transição arquitetural importante, focando na individualização do atendimento e na simplificação do sistema.

### 🚀 WhatsPanda 2.0 (Modelo 1:1)
- **Refatoração 1:1**: O sistema agora vincula cada conexão de WhatsApp diretamente ao `user_id`. Atendentes compartilhados foram removidos em favor de conexões individuais de alta performance.
- **Painel do Contato (3 Colunas)**: Interface redesenhada para oferecer uma experiência de CRM completa dentro do chat.
- **Notas de Contato**: Área dedicada para anotações internas persistentes sobre cada contato.
- **Gestão de Kanban**: Possibilidade de mover contatos entre etapas do Kanban diretamente pela barra lateral do chat.
- **Acesso Global**: O menu "Canais" agora está disponível para todos os usuários autorizados, permitindo que cada um gerencie sua própria conexão.

### 🧹 Limpeza e Simplificação
- **Remoção do CRM Legado**: O antigo módulo de CRM (Vendas, Leads, Faturas, Kanban de Vendas) foi completamente removido do sistema para reduzir a complexidade e preparar o terreno para um novo módulo no futuro.
- **Fim das Transferências**: Removida a lógica de transferência de chamados, adequando o fluxo ao modelo de atendimento direto e individual.

### 🛡️ Segurança e Auditoria
- **Ghost Mode (Zero Trace)**: Aprimorado para esconder campos de texto e botões de envio durante sessões de auditoria, garantindo que nenhum rastro seja deixado.
- **Permissões de Nudge**: Nova permissão granular `can_nudge` e configuração de `nudge_cooldown` (tempo de espera) configurável individualmente no Gerenciamento de Usuários.

---

## [1.1.1-beta] - Versão Anterior
- Implementação inicial da integração com Evolution API.
- Funcionalidades básicas de chat e grupos.
