# syntax=docker/dockerfile:1

# ──────────────────────────────────────────────
# Stage 1: Base
# ──────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache curl dumb-init
# Required for sharp (native image processing)
RUN apk add --no-cache vips-dev fftw-dev gcc g++ make

# ──────────────────────────────────────────────
# Stage 2: Dependencies
# ──────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

# ──────────────────────────────────────────────
# Stage 3: Development (hot-reload)
# ──────────────────────────────────────────────
FROM base AS development
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p /app/data/images /app/logs
EXPOSE 3001 9090
# Use dumb-init to handle signals correctly (SIGTERM → graceful shutdown)
ENTRYPOINT ["dumb-init", "--"]
CMD ["npx", "tsx", "watch", "src/index.ts"]

# ──────────────────────────────────────────────
# Stage 4: Build (TypeScript → JS)
# ──────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
# Prune dev dependencies
RUN npm install --omit=dev && npm cache clean --force

# ──────────────────────────────────────────────
# Stage 5: Production
# ──────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
# Non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/prisma ./prisma
RUN mkdir -p /app/data/images /app/logs && chown -R appuser:nodejs /app
USER appuser
EXPOSE 3001 9090
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
