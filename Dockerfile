FROM node:20-alpine AS builder
WORKDIR /app

# Copy only root package files first (better layer caching)
COPY package*.json ./
COPY nest-cli.json tsconfig*.json ./

# Install ALL dependencies (needed for build)
RUN npm ci

# Copy only backend source — NOT apps/admin or apps/customer
COPY src ./src

# Build NestJS
RUN npm run build

# ── Production image ──────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts

# Copy compiled output
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main"]
