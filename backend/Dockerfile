# Backend production Dockerfile (NestJS)
# Build context must be the repository root so npm can use the workspace lockfile.

FROM node:25-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace backend --include-workspace-root=false --no-audit --no-fund

COPY backend ./backend
WORKDIR /app/backend
RUN npm run build

FROM node:25-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace backend --include-workspace-root=false --omit=dev --no-audit --no-fund \
	&& npm cache clean --force

COPY --from=builder --chown=node:node /app/backend/dist ./dist
RUN mkdir -p /app/uploads/images \
	&& chown -R node:node /app

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
