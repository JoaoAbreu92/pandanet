# Guia de Deploy em Produção (VPS)

Siga estes passos exatos para colocar o serviço de e-mail no ar de forma definitiva.

## Passo 1: Atualizar o Código
No terminal do VPS (pode parar o comando atual com `Ctrl+C` se estiver rodando):

```bash
git pull
```

## Passo 2: Iniciar o Serviço de E-mail (Background)
Criei um script para facilitar. Ele roda o serviço "escondido" (background), então você pode fechar o terminal sem derrubar o site.

```bash
# Dar permissão de execução (só precisa fazer uma vez)
chmod +x run_email_service.sh

# Rodar o serviço
./run_email_service.sh
```
*Se der tudo certo, ele vai dizer que iniciou na porta 9999.*

## Passo 3: Configurar o Redirecionamento (Nginx)
Isso faz com que o app acesse `https://seusite.com/functions` ao invés de `localhost:9999`.

1.  Certifique-se de que o arquivo `nginx.conf` foi atualizado pelo `git pull`.
2.  Reinicie o Nginx para aplicar as mudanças:

Se estiver usando Docker:
```bash
docker-compose restart nginx
```

Se estiver usando Nginx instalado no sistema:
```bash
systemctl reload nginx
```

## Passo 4: Configurar o Frontend
Edite o arquivo `.env` (ou `.env.local`) onde o site está rodando:

```env
# Aponte para a URL pública do seu Nginx
VITE_SUPABASE_FUNCTION_URL=https://pandanet.grupopixel.com.br/functions/v1
```

Depois de editar o .env, se estiver rodando o build de produção, reinicie o container ou serviço do frontend.
