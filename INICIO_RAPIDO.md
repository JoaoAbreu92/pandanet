# 🚀 Guia de Início Rápido - PandaNet VPS

Siga estes passos **NA ORDEM** para instalar tudo do zero.

---

## ✅ ETAPA 1: Preparar a VPS

Conecte-se à sua VPS via SSH e execute:

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# IMPORTANTE: Faça logout e login novamente para aplicar permissões
exit
# (conecte-se novamente via SSH)

# Verificar se Docker está funcionando
docker --version
```

---

## ✅ ETAPA 2: Instalar Supabase

```bash
# Criar diretório e clonar
mkdir -p ~/supabase && cd ~/supabase
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# Copiar arquivo de configuração
cp .env.example .env

# Editar configurações
nano .env
```

### No arquivo `.env`, altere APENAS estas linhas:

```bash
# Senha do PostgreSQL (escolha uma senha forte)
POSTGRES_PASSWORD=SuaSenhaSuperSegura123

# JWT Secret (gere com: openssl rand -base64 32)
JWT_SECRET=resultado_do_comando_openssl

# IP da sua VPS (substitua pelo IP real)
SUPABASE_PUBLIC_URL=http://SEU_IP_VPS:8000

# Usuário e senha do Dashboard
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=SuaSenhaDashboard123
```

**Para gerar JWT_SECRET:**
```bash
openssl rand -base64 32
```

Salve o arquivo (Ctrl+O, Enter, Ctrl+X).

### Iniciar Supabase:

```bash
docker compose up -d

# Aguardar 2 minutos e verificar
docker compose ps
```

Todos os containers devem estar com status "Up" ou "healthy".

---

## ✅ ETAPA 3: Pegar as Keys do Supabase

```bash
# Ver as keys
cat ~/supabase/docker/.env | grep -E "ANON_KEY|SERVICE_ROLE_KEY"
```

**COPIE** os valores de `ANON_KEY` e `SERVICE_ROLE_KEY` que aparecerem.

---

## ✅ ETAPA 4: Configurar PandaNet (no Windows)

1. Abra o arquivo `.env.production` no projeto PandaNet
2. Preencha com os valores:

```bash
# Substitua SEU_IP_VPS pelo IP da sua VPS
VITE_SUPABASE_URL=http://SEU_IP_VPS:8000

# Cole o ANON_KEY que você copiou
VITE_SUPABASE_ANON_KEY=cole_aqui

# NÃO MUDE esta linha
SUPABASE_URL=http://supabase-kong:8000

# Cole o SERVICE_ROLE_KEY que você copiou
SUPABASE_SERVICE_KEY=cole_aqui

COMPANY_ID=1
PORT=3000
```

3. Salve o arquivo

---

## ✅ ETAPA 5: Fazer Upload do Projeto para VPS

No Windows, use SCP, SFTP ou Git para enviar o projeto para a VPS.

**Opção 1 - Git (recomendado):**
```bash
# Na VPS
cd ~
git clone https://github.com/JoaoAbreu92/pandanet.git
cd pandanet
```

**Opção 2 - SCP (do Windows):**
```powershell
# No PowerShell do Windows
scp -r C:\Users\ultim\Music\intranet\PandaNet usuario@SEU_IP_VPS:~/pandanet
```

---

## ✅ ETAPA 6: Deploy na VPS

```bash
# Na VPS, dentro da pasta do projeto
cd ~/pandanet

# Carregar variáveis de ambiente
export $(cat .env.production | xargs)

# Build e iniciar
docker compose -f docker-compose.production.yml up -d --build

# Ver logs
docker compose -f docker-compose.production.yml logs -f
```

---

## ✅ ETAPA 7: Testar

Abra no navegador:

- **PandaNet**: `http://SEU_IP_VPS`
- **Supabase Studio**: `http://SEU_IP_VPS:8000`

---

## 🆘 Problemas Comuns

### Container não inicia
```bash
docker logs pandanet_frontend
docker logs pandanet_backend
```

### Supabase não responde
```bash
cd ~/supabase/docker
docker compose ps
docker compose logs -f
```

### Porta já em uso
```bash
sudo lsof -i :80
sudo kill -9 PID
```

---

## 📞 Precisa de Ajuda?

Se tiver algum erro, me mostre:
1. A mensagem de erro completa
2. Os logs do container (`docker logs nome_container`)
3. Em qual etapa você está

---

**Resumo das Etapas:**
1. ✅ Preparar VPS (Docker)
2. ✅ Instalar Supabase
3. ✅ Pegar keys do Supabase
4. ✅ Configurar .env.production
5. ✅ Upload do projeto
6. ✅ Deploy
7. ✅ Testar
