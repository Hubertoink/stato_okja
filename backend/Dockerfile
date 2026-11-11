# Minimum patched Node runtime. The verified fallback covers the delay between
# Node security downloads and official Docker tags. Other architectures fail
# closed until their official base image contains this security release.
FROM node:24-alpine AS node-security-base
RUN set -eu; \
    if node -e "const a=process.versions.node.split('.').map(Number),b='24.22.3'.split('.').map(Number);if(a[0]!==b[0]||a[1]<b[1]||(a[1]===b[1]&&a[2]<b[2]))process.exit(1)"; then exit 0; fi; \
    case "$(uname -m)" in \
      x86_64) archive="node-v24.22.3-linux-x64-musl.tar.gz"; checksum="5499b663f62c72093715da98f4aea6f83427ad8bab9cf9c75f0924e0e456ce14" ;; \
      *) echo "Patched Node 24.22.3 base image required for this architecture" >&2; exit 1 ;; \
    esac; \
    wget -qO /tmp/node-security.tar.gz "https://nodejs.org/dist/v24.22.3/$archive"; \
    echo "$checksum  /tmp/node-security.tar.gz" | sha256sum -c -; \
    tar -xzf /tmp/node-security.tar.gz --strip-components=2 -C /usr/local/bin "${archive%.tar.gz}/bin/node"; \
    rm /tmp/node-security.tar.gz; \
    node -e "const a=process.versions.node.split('.').map(Number),b='24.22.3'.split('.').map(Number);if(a[0]!==b[0]||a[1]<b[1]||(a[1]===b[1]&&a[2]<b[2]))process.exit(1)"

# Backend production Dockerfile (NestJS)
# Build context must be the repository root so npm can use the workspace lockfile.

FROM node-security-base AS builder
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

FROM node-security-base AS runner
# Refresh security fixes even when the upstream Node image has not been rebuilt.
RUN apk upgrade --no-cache
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
	&& npm install --prefix /tmp/runtime-patches brace-expansion@2.1.7 --no-save --package-lock=false --ignore-scripts --no-audit --no-fund --loglevel=error \
	&& rm -rf /app/backend/node_modules/brace-expansion \
	&& cp -a /tmp/runtime-patches/node_modules/brace-expansion /app/backend/node_modules/brace-expansion \
	&& rm -rf /tmp/runtime-patches \
	&& node -e "const path = require('path'); const typeorm = require.resolve('typeorm'); require.resolve('tinyglobby', { paths: [path.dirname(typeorm)] }); for (const dependency of ['@nestjs/swagger', 'body-parser', 'brace-expansion']) require.resolve(dependency); const [yamlMajor, yamlMinor, yamlPatch] = require(require.resolve('js-yaml/package.json', { paths: [path.dirname(require.resolve('@nestjs/swagger'))] })).version.split('.').map(Number); if (yamlMajor !== 5 || !(yamlMinor > 2 || (yamlMinor === 2 && yamlPatch >= 2))) throw new Error('Swagger requires patched js-yaml >=5.2.2 <6'); if (require('brace-expansion/package.json').version !== '2.1.7') process.exit(1)" \
	&& npm cache clean --force \
	&& rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY --from=builder --chown=node:node /app/backend/dist ./dist
COPY --chown=node:node legal ./legal
RUN mkdir -p /app/uploads/images \
	&& chown -R node:node /app

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
