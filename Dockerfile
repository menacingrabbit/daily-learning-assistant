# Multi-stage build. node:24-slim (glibc) so better-sqlite3 uses its prebuilt
# binaries - no compiler or libc headers are installed. Prebuilds exist for
# linux-x64 and linux-arm64 (glibc); other architectures would have to
# node-gyp-compile and fail here without a toolchain.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src/ ./src/
RUN npm run build && npm prune --omit=dev

FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY config/ ./config/
# Kept outside /app/config because the ./config bind mount shadows that path.
COPY config/topics.example.yaml /opt/dla/topics.example.yaml
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /app/data

VOLUME ["/app/data"]

# No EXPOSE: the app has no HTTP server. It runs a cron scheduler, writes
# SQLite, and (optionally) long-polls Telegram. There is no port to open.
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
