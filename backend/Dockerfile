# Backend production Dockerfile (NestJS)
# Build context must be the repository root so npm can use the workspace lockfile.

FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace backend --include-workspace-root=false --no-audit --no-fund

COPY backend ./backend
WORKDIR /app/backend
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# npm installs workspace dependencies below /app/backend/node_modules. The
# compiled application intentionally runs from /app so uploads stay on the
# existing /app/uploads volume; expose the workspace's runtime modules to Node.
ENV NODE_PATH=/app/backend/node_modules

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
# NPM is only required while building the image. Removing it keeps its bundled
# package-manager toolchain out of the production runtime image.
# npm leaves a no-longer-required vulnerable development dependency in the
# workspace subdirectory. The resolved production copy remains 2.1.2 at
# /app/node_modules/brace-expansion.
RUN npm ci --workspace backend --include-workspace-root=false --omit=dev --no-audit --no-fund \
	&& npm install --prefix /app/node_modules/@nestjs/swagger js-yaml@5.2.2 --no-save --package-lock=false --ignore-scripts --no-audit --no-fund \
	&& rm -rf /app/backend/node_modules/brace-expansion \
	&& node -e "for (const dependency of ['@nestjs/swagger', 'body-parser', 'brace-expansion']) require.resolve(dependency); if (require('/app/node_modules/@nestjs/swagger/node_modules/js-yaml/package.json').version !== '5.2.2') process.exit(1)" \
	&& test ! -e /app/backend/node_modules/brace-expansion \
	&& npm cache clean --force \
	&& rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY --from=builder --chown=node:node /app/backend/dist ./dist
COPY --chown=node:node legal ./legal
RUN mkdir -p /app/uploads/images \
	&& chown -R node:node /app

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
