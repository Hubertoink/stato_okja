# Frontend production Dockerfile (React + Vite) with unprivileged Nginx
# Build context must be the repository root so npm can use the workspace lockfile.

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace frontend --include-workspace-root=false --no-audit --no-fund

COPY frontend ./frontend
WORKDIR /app/frontend
# Allow passing the API base URL at build time for Modus B
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ARG VITE_ENABLE_DEV_TOOLS=false
ENV VITE_ENABLE_DEV_TOOLS=${VITE_ENABLE_DEV_TOOLS}
ARG VITE_ENABLE_ORG_MOVE=false
ENV VITE_ENABLE_ORG_MOVE=${VITE_ENABLE_ORG_MOVE}
ARG VITE_COMMIT_SHA
ENV VITE_COMMIT_SHA=${VITE_COMMIT_SHA}
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine AS runner
USER root
WORKDIR /usr/share/nginx/html

# Remove default content and config
RUN rm -rf ./* /etc/nginx/conf.d/* /etc/nginx/templates/*

# Copy build
COPY --from=builder --chown=101:101 /app/frontend/dist .

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
