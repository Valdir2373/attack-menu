# CLI Principal — TypeScript + React Ink (orquestrador)
# Este é o container interativo que o usuário executa
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    cowsay \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/games/cowsay /usr/local/bin/cowsay

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --production=false

COPY src/ /app/src/
COPY public/ /app/public/
COPY main.ts /app/

EXPOSE 3000

CMD ["npx", "tsx", "main.ts"]
