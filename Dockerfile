# Multi-stage build. node:24-slim (glibc) so better-sqlite3 can use prebuilt
# binaries; build stage additionally installs toolchain as a fallback.
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
RUN mkdir -p /app/data

VOLUME ["/app/data"]
EXPOSE 3000

# Start the scheduler (daily reminder + reply listener).
CMD ["node", "dist/index.js"]