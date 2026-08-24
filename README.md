# 🐼 PandaNet — Intranet Corporativa Inteligente

<div align="center">
  <img alt="PandaNet Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

---

## 🚀 Sobre o Projeto

O **PandaNet** é uma plataforma de Intranet All-in-One desenhada para transformar a comunicação interna e a gestão de recursos humanos em empresas modernas. Com uma estética **premium**, interface fluida e ferramentas integradas, o sistema centraliza desde a interação social até o suporte técnico e atendimento via WhatsApp.

Este projeto foi construído com foco em **Multi-tenancy (SaaS)**, permitindo que múltiplas empresas utilizem a mesma infraestrutura com total isolamento de dados.

---

## ✨ Funcionalidades Principais

### 📱 WhatsPanda (Gestão de WhatsApp)
Uma solução robusta para atendimento centralizado:
- **Conexão Multi-dispositivo:** Gestão de múltiplas sessões de WhatsApp.
- **Filas e Departamentos:** Direcionamento inteligente de leads e clientes.
- **Distribuição de Atendentes:** Atribuição granular de permissões e atendimentos.
- **Sincronização em Tempo Real:** Histórico de mensagens e contatos sempre atualizados.

### 🌐 Social & Engajamento
- **Mural Digital:** Feed de notícias dinâmico com suporte a mídias, reações e comentários.
- **Anúncios e Banners:** Comunicação oficial de destaque para toda a companhia.
- **Reconhecimentos:** Sistema para celebrar conquistas entre colaboradores.

### 📊 Gestão de RH (Human Resources)
- **Portal de Benefícios:** Centralização de informações sobre saúde, lazer e vantagens.
- **Treinamentos:** Plataforma de e-learning com módulos de capacitação interna.
- **Recrutamento:** Mural de vagas internas com gestão de candidaturas.
- **Documentação:** Repositório central para holerites, manuais e políticas.

### 🛠️ Suporte & Operações
- **Chamados (IT Service Desk):** Sistema de tickets para TI e manutenção.
- **Base de Conhecimento:** Central de ajuda para resolução rápida de problemas.
- **Marketplace Interno:** Espaço para troca ou venda de itens entre colaboradores.
- **Painel de KPIs:** Indicadores estratégicos em tempo real via Recharts.

---

## 🏗️ Stack Tecnológica

| Camada | Tecnologia |
| :--- | :--- |
| **Frontend** | React 18 + TypeScript |
| **Build Tool** | Vite |
| **Styling** | Vanilla CSS (Modern Design System) |
| **Backend/DB** | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| **WhatsApp Engine** | Node.js + @whiskeysockets/baileys |
| **Infraestrutura** | Docker & Docker Compose |
| **Gerenciamento** | Portainer |

---

## 🛠️ Instalação Local

1. **Clonar o Repositório:**
   ```bash
   git clone https://github.com/SeuUsuario/pandanet.git
   cd pandanet
   ```

2. **Instalar Dependências:**
   ```bash
   npm install
   ```

3. **Configurar Variáveis:**
   Crie um `.env.local` com suas chaves do Supabase:
   ```env
   VITE_SUPABASE_URL=seu_url
   VITE_SUPABASE_ANON_KEY=sua_key
   ```

4. **Executar:**
   ```bash
   npm run dev
   ```

---

## 🐳 Deploy via Docker

O projeto está pronto para rodar em produção via Docker Compose:

```bash
docker compose -f docker-compose.prod.yml up -d
```

---

<div align="center">
  <p>Desenvolvido com ❤️ para a excelência organizacional.</p>
</div>
