# Backend production Dockerfile (NestJS)
# Build context must be the repository root so npm can use the workspace lockfile.

FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace backend --include-workspace-root=false --no-audit --no-fund --loglevel=error

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
# /app/node_modules/brace-expansion. TypeORM 0.3.31 additionally pins the
# deprecated glob 10 line; Node 22 supports glob 12 and TypeORM only uses its
# compatible synchronous API. Install it in TypeORM's local module tree and
# remove the deprecated production copy from the final image.
RUN npm ci --workspace backend --include-workspace-root=false --omit=dev --no-audit --no-fund --loglevel=error \
	&& mkdir -p /tmp/typeorm-glob \
	&& printf '{"private":true}\n' > /tmp/typeorm-glob/package.json \
	&& npm install --prefix /tmp/typeorm-glob glob@12.0.0 --no-save --package-lock=false --ignore-scripts --no-audit --no-fund --loglevel=error \
	&& typeorm_dir="$(dirname "$(node -p "require.resolve('typeorm')")")" \
	&& typeorm_glob_dir="$(dirname "$(node -p "const path = require('path'); require.resolve('glob', { paths: [path.dirname(require.resolve('typeorm'))] })")")" \
	&& mkdir -p "$typeorm_dir/node_modules" \
	&& cp -a /tmp/typeorm-glob/node_modules/. "$typeorm_dir/node_modules/" \
	&& rm -rf /tmp/typeorm-glob \
	&& npm install --prefix /app/node_modules/@nestjs/swagger js-yaml@5.2.2 --no-save --package-lock=false --ignore-scripts --no-audit --no-fund \
	&& rm -rf "$typeorm_glob_dir" /app/node_modules/glob /app/backend/node_modules/glob \
	&& rm -rf /app/backend/node_modules/brace-expansion \
	&& node -e "const path = require('path'); const typeorm = require.resolve('typeorm'); const glob = require(require.resolve('glob', { paths: [path.dirname(typeorm)] })); for (const dependency of ['@nestjs/swagger', 'body-parser', 'brace-expansion']) require.resolve(dependency); if (typeof glob.sync !== 'function' || require(require.resolve('glob/package.json', { paths: [path.dirname(typeorm)] })).version !== '12.0.0' || require('/app/node_modules/@nestjs/swagger/node_modules/js-yaml/package.json').version !== '5.2.2') process.exit(1)" \
	&& test ! -e "$typeorm_glob_dir" \
	&& test ! -e /app/node_modules/glob \
	&& test ! -e /app/backend/node_modules/glob \
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
