# 🚀 Deploy PandaNet na VPS

Guia rápido para fazer deploy do PandaNet em uma VPS Ubuntu com Docker, Portainer e Supabase self-hosted.

## 📋 Pré-requisitos

- VPS com Ubuntu 24.04 LTS
- Acesso SSH à VPS
- Mínimo 4GB RAM (recomendado 8GB)
- Mínimo 40GB de disco

## 🎯 Guia Completo

Para o guia completo passo a passo, consulte o arquivo de planejamento nos artifacts da conversa com a IA.

O guia completo inclui:
- Instalação do Docker e Docker Compose
- Instalação do Portainer
- Configuração do Supabase self-hosted
- Deploy da aplicação
- Configuração de backup automático
- Troubleshooting

## ⚡ Início Rápido

### 1. Preparar VPS

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Instalar Portainer
docker volume create portainer_data
docker run -d -p 9000:9000 -p 9443:9443 --name portainer --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data portainer/portainer-ce:latest
```

### 2. Instalar Supabase

```bash
# Clonar repositório
mkdir -p ~/supabase && cd ~/supabase
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# Configurar variáveis
cp .env.example .env
nano .env  # Edite as variáveis necessárias

# Iniciar Supabase
docker compose up -d
```

### 3. Deploy do PandaNet

```bash
# Clonar/fazer upload do projeto
mkdir -p ~/pandanet && cd ~/pandanet
# (faça upload dos arquivos ou clone do git)

# Configurar variáveis de ambiente
cp .env.production.template .env.production
nano .env.production  # Preencha com suas configurações

# Carregar variáveis e iniciar
export $(cat .env.production | xargs)
docker compose -f docker-compose.production.yml up -d --build
```

## 📁 Arquivos de Configuração

- **`docker-compose.production.yml`** - Configuração Docker para produção
- **`.env.production.template`** - Template de variáveis de ambiente
- **`scripts/backup-supabase.sh`** - Script de backup automático

## 🔑 Variáveis de Ambiente Importantes

Copie `.env.production.template` para `.env.production` e preencha:

```bash
# Frontend (IP público da VPS)
VITE_SUPABASE_URL=http://SEU_IP_VPS:8000
VITE_SUPABASE_ANON_KEY=sua_anon_key

# Backend (nome do container)
SUPABASE_URL=http://supabase-kong:8000
SUPABASE_SERVICE_KEY=sua_service_role_key

COMPANY_ID=1
PORT=3000
```

> **Importante**: As keys do Supabase estão em `~/supabase/docker/.env` na VPS

## 🌐 Acessos

Após o deploy:

- **PandaNet**: `http://SEU_IP_VPS`
- **Supabase Studio**: `http://SEU_IP_VPS:8000`
- **Portainer**: `http://SEU_IP_VPS:9000`

## 💾 Backup

```bash
# Dar permissão ao script
chmod +x scripts/backup-supabase.sh

# Executar backup manual
./scripts/backup-supabase.sh

# Configurar backup automático (diário às 2h)
crontab -e
# Adicione: 0 2 * * * ~/pandanet/scripts/backup-supabase.sh
```

## 🔧 Comandos Úteis

```bash
# Ver status dos containers
docker compose -f docker-compose.production.yml ps

# Ver logs
docker compose -f docker-compose.production.yml logs -f

# Reiniciar aplicação
docker compose -f docker-compose.production.yml restart

# Parar aplicação
docker compose -f docker-compose.production.yml down

# Rebuild completo
docker compose -f docker-compose.production.yml up -d --build
```

## 🆘 Troubleshooting

### Container não inicia
```bash
docker logs pandanet_frontend
docker logs pandanet_backend
```

### Erro de conexão com Supabase
```bash
# Verificar se Supabase está rodando
docker ps | grep supabase

# Testar conectividade
docker exec pandanet_backend curl http://supabase-kong:8000
```

### Porta já em uso
```bash
sudo lsof -i :80
sudo kill -9 PID
```

## 📚 Documentação Adicional

Consulte os artifacts da conversa com a IA para:
- Guia completo de instalação (`implementation_plan.md`)
- Checklist de verificação (`checklist_verificacao.md`)
- Comandos rápidos (`comandos_rapidos.md`)

## 🔒 Segurança

- ✅ Configure firewall (UFW)
- ✅ Use senhas fortes
- ✅ Nunca commite `.env.production` no Git
- ✅ Configure SSL/HTTPS para produção
- ✅ Mantenha backups regulares

## 📞 Suporte

Para dúvidas ou problemas, consulte a documentação completa nos artifacts ou entre em contato com o time de desenvolvimento.

---

**Última atualização**: 2026-02-13
