# ============================================================
# Dockerfile — Express API Server (Multi-stage Production Build)
# ============================================================

# ── Stage 1: Dependencies + Prisma Generate ──────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

# ── Stage 2: Production Runtime ──────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Create non-root user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser

# Copy production dependencies and Prisma client
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy application code
COPY prisma ./prisma/
COPY src ./src/

USER appuser

EXPOSE 5000

<<<<<<< HEAD
CMD ["node", "src/server.js"]
>>>>>>> 3433e98 (Fix SMP tracking and complete proxy migration)
