# Backend production Dockerfile (NestJS)

FROM node:20-alpine AS builder
WORKDIR /app

# Install all deps (including dev) for build
COPY package*.json ./
RUN npm install --no-audit --no-fund

# Copy source and build
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install only production deps
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy built artifacts
COPY --from=builder /app/dist ./dist

# Ensure uploads directory exists (mounted as volume in compose)
RUN mkdir -p /app/uploads/images

EXPOSE 3000
CMD ["node", "dist/main.js"]
