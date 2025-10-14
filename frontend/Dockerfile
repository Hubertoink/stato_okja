# Frontend production Dockerfile (React + Vite) with Nginx

FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:1.27-alpine AS runner
WORKDIR /usr/share/nginx/html

# Remove default content and config
RUN rm -rf ./* /etc/nginx/conf.d/*

# Copy build
COPY --from=builder /app/dist .

# Add our Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
