# syntax=docker/dockerfile:1

# ================================================================
# Stage 1: Dependencies
# ================================================================
FROM node:20-slim AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# ================================================================
# Stage 2: Builder
# ================================================================
FROM node:20-slim AS builder
WORKDIR /app

# openssl is required by the Prisma query engine. `next build` initializes
# the Prisma client during static generation, so the library must be present
# at build time too — not only in the runner stage.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application code (includes prisma/schema.prisma + migrations)
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Limit Node.js memory for low-RAM servers
ENV NODE_OPTIONS="--max-old-space-size=512"

# Generate Prisma Client for the build platform (linux debian-slim).
# Without this, the standalone output would bundle the local dev-platform
# query engine (e.g. darwin-arm64) and crash inside the container.
RUN npx prisma generate

# Build Next.js application
RUN npm run build

# ================================================================
# Stage 3: Runner (Production)
# ================================================================
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install openssl — required by the Prisma query engine on debian-slim.
# (On alpine this would be `apk add --no-cache openssl` and is more fragile.)
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Create system user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Copy standalone Next.js output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma artifacts so migrations can run at startup:
#   - prisma/                  : schema.prisma + migrations/
#   - node_modules/.prisma      : generated client + linux query engine
#   - node_modules/prisma       : Prisma CLI (needed for `migrate deploy`)
#   - node_modules/@prisma/     : engine binaries + internal packages
#     (prisma CLI lazily requires @prisma/engines, @prisma/debug,
#      @prisma/get-platform, @prisma/fetch-engine — copy the whole scope
#      rather than chasing the dependency chain package by package)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy entrypoint script (runs migrations before starting the server)
COPY --chmod=0755 docker-entrypoint.sh ./docker-entrypoint.sh

# Create the prisma data directory and hand ownership to the non-root user.
# The sqlite volume (sqlite-data) mounts here; migrations write dev.db into it.
RUN mkdir -p /app/prisma && chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# DATABASE_URL is read from the runtime env (.env via docker-compose).
# Default targets the volume-mounted prisma directory.
ENV DATABASE_URL="file:/app/prisma/dev.db"

# Entrypoint: apply pending migrations, then start the standalone server.
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
