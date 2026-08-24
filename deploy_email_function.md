# Como Implantar a Função de E-mail no VPS

Como você está usando um Supabase Self-Hosted (VPS), a função `email-handler` precisa rodar nesse servidor para que o sistema consiga acessá-la.

## Opção 1: Usando Deno (Recomendado)

Se você tiver o Deno instalado no VPS, pode rodar o serviço diretamente.

1.  **Instale as dependências (unzip):**
    ```bash
    # Debian/Ubuntu
    apt-get update && apt-get install unzip -y
    
    # CentOS/RHEL
    # yum install unzip -y
    ```

2.  **Instale o Deno:**
    ```bash
    curl -fsSL https://deno.land/x/install/install.sh | sh
    ```

2.  **Rode a função:**
    Navegue até a pasta do projeto e execute:
    ```bash
    # Opção A: Usando o comando direto (se estiver no PATH)
    deno run --allow-net --allow-env --watch supabase/functions/email-handler/index.ts

    # Opção B: Usando o caminho absoluto (Recomendado se der erro "command not found")
    /root/.deno/bin/deno run --allow-net --allow-env --watch supabase/functions/email-handler/index.ts
    ```
    *A função rodará na porta **9999**.*

3.  **Mantenha rodando:**
    Use `pm2` ou `systemd` para manter o processo ativo em produção.

## Opção 2: Usando Supabase CLI no VPS

Se você tiver o CLI do Supabase no VPS:

```bash
supabase functions serve email-handler --no-verify-jwt --env-file .env
```

## Configuração no Frontend (Importante!)

O frontend (React) precisa saber onde a função está rodando.
Edite o arquivo `.env` (ou `.env.local`) no servidor onde está o Frontend e adicione:

```env
VITE_SUPABASE_FUNCTION_URL=http://localhost:9999/email-handler
```
*(Substitua `http://localhost:9999` pelo IP/Porta onde você rodou a função)*

Se você não definir essa variável, o sistema tentará usar a URL padrão do Supabase, o que pode falhar em setups híbridos.
