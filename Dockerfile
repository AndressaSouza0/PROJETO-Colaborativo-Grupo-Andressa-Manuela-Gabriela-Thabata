FROM node:18-slim

# Instala Chromium e fontes necessárias para o whatsapp-web.js funcionar no Linux
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-freefont-ttf \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Informa ao Puppeteer onde encontrar o Chromium instalado
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Copia e instala dependências do servidor
COPY servidor-whatsapp/package*.json ./servidor-whatsapp/
RUN cd servidor-whatsapp && npm install --omit=dev

# Copia o restante do projeto (frontend + servidor)
COPY . .

EXPOSE 3000

CMD ["node", "servidor-whatsapp/bot.js"]
