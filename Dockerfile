# Multi-stage build for optimized production image

# Stage 1: Dependencies
FROM node:24-alpine AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev dependencies for build)
RUN npm ci

# Stage 2: Builder
FROM node:24-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 3: Production
FROM node:24-alpine AS production

# Create non-root user first (before any COPY)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Install PostgreSQL client for migrations healthcheck
RUN apk add --no-cache postgresql-client

WORKDIR /app

# Copy production dependencies from deps stage (skip second npm ci)
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy necessary runtime files
COPY --from=builder --chown=nodejs:nodejs /app/src/analysis/prompts ./dist/analysis/prompts
COPY --from=builder --chown=nodejs:nodejs /app/src/bot/templates ./dist/bot/templates

# Copy ALL source files for TypeORM migrations (needs entities)
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/tsconfig.json ./tsconfig.json

# Copy entrypoint script
COPY --chown=nodejs:nodejs docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nodejs

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Use entrypoint script
ENTRYPOINT ["docker-entrypoint.sh"]
