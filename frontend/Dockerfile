# Frontend production Dockerfile (React + Vite) with Nginx

FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY . .
# Allow passing the API base URL at build time for Modus B
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:1.27-alpine AS runner
WORKDIR /usr/share/nginx/html

# Remove default content and config
RUN rm -rf ./* /etc/nginx/conf.d/* /etc/nginx/templates/*

# Copy build
COPY --from=builder /app/dist .

# Add our Nginx configs and select based on build arg (default: direct = no proxy)
ARG NGINX_MODE=direct
COPY nginx.direct.conf /etc/nginx/conf.d/default.direct.conf
COPY nginx.proxy.conf /etc/nginx/conf.d/default.proxy.conf
# Select a single config and delete temp files so only default.conf remains
RUN if [ "$NGINX_MODE" = "proxy" ]; then \
			cp /etc/nginx/conf.d/default.proxy.conf /etc/nginx/conf.d/default.conf; \
		else \
			cp /etc/nginx/conf.d/default.direct.conf /etc/nginx/conf.d/default.conf; \
		fi && \
		rm -f /etc/nginx/conf.d/default.direct.conf /etc/nginx/conf.d/default.proxy.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
