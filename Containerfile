FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY db/ ./db/

RUN pnpm install --frozen-lockfile || pnpm install

COPY backend/ ./backend/

EXPOSE 3000
CMD ["pnpm", "start"]
