FROM node:20-alpine

# Instalar curl para o healthcheck
RUN apk add --no-cache curl

WORKDIR /app

COPY package.json package-lock.json ./

# Instalar dependências de produção
RUN npm ci --only=production

COPY . .

# Variáveis de ambiente devem ser passadas no run/compose
ENV NODE_ENV=production

CMD ["node", "index.js"]
