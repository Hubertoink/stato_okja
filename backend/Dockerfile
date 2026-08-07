# Backend production Dockerfile (NestJS)
# Build context must be the repository root so npm can use the workspace lockfile.

FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace backend --include-workspace-root=false --no-audit --no-fund --loglevel=error

COPY backend ./backend
WORKDIR /app/backend
# A host-side incremental build cache can be present in a source checkout while
# its matching dist directory is excluded from the Docker context. Remove it
# so Nest always emits the complete runtime bundle inside the image.
RUN rm -f tsconfig.tsbuildinfo && npm run build

FROM node:24-alpine AS runner
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
# npm can retain a development-only brace-expansion 1.x copy in the backend
# workspace. Replace it explicitly with the patched runtime version.
RUN npm ci --workspace backend --include-workspace-root=false --omit=dev --no-audit --no-fund --loglevel=error \
	&& npm install --prefix /tmp/runtime-patches brace-expansion@2.1.4 --no-save --package-lock=false --ignore-scripts --no-audit --no-fund --loglevel=error \
	&& rm -rf /app/backend/node_modules/brace-expansion \
	&& cp -a /tmp/runtime-patches/node_modules/brace-expansion /app/backend/node_modules/brace-expansion \
	&& rm -rf /tmp/runtime-patches \
	&& npm install --prefix /app/node_modules/@nestjs/swagger js-yaml@5.2.2 --no-save --package-lock=false --ignore-scripts --no-audit --no-fund \
	&& node -e "const path = require('path'); const typeorm = require.resolve('typeorm'); require.resolve('tinyglobby', { paths: [path.dirname(typeorm)] }); for (const dependency of ['@nestjs/swagger', 'body-parser', 'brace-expansion']) require.resolve(dependency); if (require('brace-expansion/package.json').version !== '2.1.4' || require('/app/node_modules/@nestjs/swagger/node_modules/js-yaml/package.json').version !== '5.2.2') process.exit(1)" \
	&& npm cache clean --force \
	&& rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY --from=builder --chown=node:node /app/backend/dist ./dist
COPY --chown=node:node legal ./legal
RUN mkdir -p /app/uploads/images \
	&& chown -R node:node /app

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
