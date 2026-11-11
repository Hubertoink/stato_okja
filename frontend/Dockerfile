# Minimum patched Node runtime. The verified fallback covers the delay between
# Node security downloads and official Docker tags. Other architectures fail
# closed until their official base image contains this security release.
FROM node:24-bookworm-slim AS node-security-base
RUN set -eu; \
    if node -e "const a=process.versions.node.split('.').map(Number),b='24.22.3'.split('.').map(Number);if(a[0]!==b[0]||a[1]<b[1]||(a[1]===b[1]&&a[2]<b[2]))process.exit(1)"; then exit 0; fi; \
    case "$(uname -m)" in \
      x86_64) archive="node-v24.22.3-linux-x64.tar.gz"; checksum="061ec3e3062115705b56b51fa9cc330ab50d34b6969387d4e4b1a50c6809acc2" ;; \
      aarch64) archive="node-v24.22.3-linux-arm64.tar.gz"; checksum="261af2af250dfd7e9f25cf151d1b2713a0adf8f10a9ad116c4947f68627affe8" ;; \
      *) echo "Patched Node 24.22.3 base image required for this architecture" >&2; exit 1 ;; \
    esac; \
    apt-get update && apt-get install -y --no-install-recommends ca-certificates curl; \
    curl --fail --location --retry 3 -o /tmp/node-security.tar.gz "https://nodejs.org/dist/v24.22.3/$archive"; \
    echo "$checksum  /tmp/node-security.tar.gz" | sha256sum -c -; \
    tar -xzf /tmp/node-security.tar.gz --strip-components=2 -C /usr/local/bin "${archive%.tar.gz}/bin/node"; \
    rm /tmp/node-security.tar.gz; \
    node -e "const a=process.versions.node.split('.').map(Number),b='24.22.3'.split('.').map(Number);if(a[0]!==b[0]||a[1]<b[1]||(a[1]===b[1]&&a[2]<b[2]))process.exit(1)"

# Frontend production Dockerfile (React + Vite) with unprivileged Nginx
# Build context must be the repository root so npm can use the workspace lockfile.

FROM node-security-base AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY VERSION ./VERSION
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace frontend --include-workspace-root=false --no-audit --no-fund

COPY frontend ./frontend
COPY docs/env-generator ./docs/env-generator
RUN node -e "const fs=require('fs'); const p='docs/env-generator/template.js'; const v=fs.readFileSync('VERSION','utf8').trim(); fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace(/ZIMAOS_DEFAULT_VERSION = '[^']+'/,'ZIMAOS_DEFAULT_VERSION = '+JSON.stringify(v)))"
WORKDIR /app/frontend
# Allow passing the API base URL at build time for Modus B
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ARG VITE_ENABLE_DEV_TOOLS=false
ENV VITE_ENABLE_DEV_TOOLS=${VITE_ENABLE_DEV_TOOLS}
ARG VITE_ENABLE_ORG_MOVE=false
ENV VITE_ENABLE_ORG_MOVE=${VITE_ENABLE_ORG_MOVE}
ARG VITE_DEMO_MODE=false
ENV VITE_DEMO_MODE=${VITE_DEMO_MODE}
ARG VITE_COMMIT_SHA
ENV VITE_COMMIT_SHA=${VITE_COMMIT_SHA}
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.31-alpine AS runner
USER root
WORKDIR /usr/share/nginx/html

# Refresh Alpine packages before removing the unused curl and image-filter stacks.
# This keeps the final Nginx image on the patched package revisions published
# by the upstream Alpine repository.
# Image filtering is handled by the backend; Nginx only serves static assets
# and proxies requests. Removing this module also removes libuuid/X11 dependencies.
RUN apk upgrade --no-cache && \
		apk del --no-network curl nginx-module-image-filter

# Remove default content and config
RUN rm -rf ./* /etc/nginx/conf.d/* /etc/nginx/templates/*

# Copy build
COPY --from=builder --chown=101:101 /app/frontend/dist .
COPY --from=builder --chown=101:101 /app/docs/env-generator ./env-generator
COPY --chown=101:101 docs/start ./start

# Add our Nginx configs and select based on build arg (default: direct = prod safety net). Also support direct-dev.
ARG NGINX_MODE=direct
COPY frontend/nginx.direct.conf /etc/nginx/conf.d/default.direct.conf
COPY frontend/nginx.proxy.conf /etc/nginx/conf.d/default.proxy.conf
COPY frontend/nginx.direct.dev.conf /etc/nginx/conf.d/default.direct.dev.conf
# Select single config to default.conf and remove any others so only one *.conf remains
RUN if [ "$NGINX_MODE" = "proxy" ]; then \
			cp /etc/nginx/conf.d/default.proxy.conf /etc/nginx/conf.d/default.conf; \
		elif [ "$NGINX_MODE" = "direct-dev" ]; then \
			cp /etc/nginx/conf.d/default.direct.dev.conf /etc/nginx/conf.d/default.conf; \
		else \
			cp /etc/nginx/conf.d/default.direct.conf /etc/nginx/conf.d/default.conf; \
		fi && \
		rm -f /etc/nginx/conf.d/default.direct.conf /etc/nginx/conf.d/default.proxy.conf /etc/nginx/conf.d/default.direct.dev.conf && \
		chown -R 101:101 /usr/share/nginx/html /etc/nginx/conf.d

USER 101
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
