FROM node:20-bookworm AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

FROM node:20-bookworm AS backend-builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ pkg-config libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./backend/
COPY backend/patches ./backend/patches
RUN cd backend && npm ci
COPY backend/ ./backend/
RUN cd backend && npx tsc --skipLibCheck

FROM node:20-slim AS production
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl libcairo2 libpango-1.0-0 libjpeg62-turbo libgif7 dumb-init \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=frontend-builder --chown=1001:1001 /app/frontend/dist ./frontend/dist
COPY --from=backend-builder --chown=1001:1001 /app/backend/dist ./backend/dist
COPY --from=backend-builder --chown=1001:1001 /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder --chown=1001:1001 /app/backend/package*.json ./backend/
COPY --from=backend-builder --chown=1001:1001 /app/backend/drizzle.config.ts ./backend/
COPY --from=backend-builder --chown=1001:1001 /app/backend/drizzle ./backend/drizzle
RUN npm prune --prefix /app/backend --production --ignore-scripts
RUN mkdir -p /app/backend/uploads/templates /app/uploads /app/backend/baileys_auth_info \
    && chown -R 1001:1001 /app/backend/uploads /app/uploads /app/backend/baileys_auth_info
COPY --from=backend-builder --chown=1001:1001 /app/backend/uploads/templates/ /app/backend/uploads/templates/
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs hadirq
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -sf http://localhost:3001/api/health || exit 1
USER hadirq
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "backend/dist/index.js"]
