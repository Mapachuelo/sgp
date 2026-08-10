FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@11 --activate

WORKDIR /app

# Copiar archivos de configuración del workspace primero (cache de build)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Instalar dependencias con lockfile determinista
RUN pnpm install --frozen-lockfile

# Copiar código fuente del backend y scripts de DB
COPY backend/ ./backend/
COPY db/ ./db/

EXPOSE 3000
CMD ["pnpm", "start"]
