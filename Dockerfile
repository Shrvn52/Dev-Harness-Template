# Minimal ship path: `docker build -t app . && docker run -p 8137:8137 app`
# serves the whole app (API + built frontend) on one port. This is deliberately
# the SMALLEST production story — no compose, no orchestration, no TLS; put a
# reverse proxy in front and mount /data for persistence.
#
# node:22-slim, not alpine: better-sqlite3 ships glibc prebuilds, so slim
# installs without a compiler toolchain in the runtime image.

# ── Build stage — full workspace install, then compile both tiers.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY shared/package.json shared/
RUN npm ci
COPY . .
RUN npm run build

# ── Runtime stage — production deps only, plus the two build artifacts.
FROM node:22-slim
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8137 \
    DB_PATH=/data/app.db
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY shared/package.json shared/
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/frontend/dist frontend/dist
# better-sqlite3 needs the directory to exist; a volume mount replaces it for
# real persistence: docker run -v appdata:/data …
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8137
WORKDIR /app/backend
CMD ["node", "dist/backend/src/index.js"]
