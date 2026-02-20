FROM node:20-bookworm-slim AS builder

WORKDIR /opt/aryazos

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     ca-certificates python3 make g++ \
     unzip \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

COPY study-sync/docker/workspace.pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY study-sync/docker/workspace.package.json ./package.json
COPY ts-base ./ts-base
COPY ts-ui ./ts-ui
COPY ts-views ./ts-views
COPY ts-config ./ts-config
COPY study ./study
COPY study-sync ./study-sync

ENV ELECTRON_BUILDER_SKIP_INSTALL_DEPENDENCIES=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CI=true

RUN if [ ! -d study/cli ]; then \
    mkdir -p study/cli && \
    echo '{"name": "@aryazos/study-cli", "version": "0.0.0", "main": "./index.js"}' > study/cli/package.json; \
  fi \
  && if [ ! -d study-core ]; then \
    mkdir -p study-core && \
    echo '{"name": "@aryazos/study-core", "version": "0.0.0", "main": "./index.js"}' > study-core/package.json && \
    echo 'module.exports = {};' > study-core/index.js; \
  fi \
  && pnpm install --filter @aryazos/study-sync... \
  && pnpm --filter @aryazos/study-sync build:server \
  && pnpm -C study-sync prune --prod --ignore-scripts

# Prepare minimal runtime dependencies (avoid full workspace deps)
RUN mkdir -p /opt/runtime \
  && printf '%s\n' '{ "name": "aryazos-study-sync-runtime", "private": true, "type": "commonjs", "dependencies": { "playwright": "^1.55.0", "sqlite3": "^5.1.7" } }' > /opt/runtime/package.json \
  && npm --prefix /opt/runtime install --omit=dev --no-audit --no-fund

FROM node:20-bookworm-slim AS runtime

WORKDIR /opt/aryazos/study-sync

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     ca-certificates \
     libreoffice-nogui \
     unzip \
     # Playwright/Chromium dependencies (browsers mounted from host)
     libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
     libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
     libxdamage1 libxfixes3 libxrandr2 libgbm1 \
     libasound2 libpango-1.0-0 libcairo2 libatspi2.0-0 \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY --from=builder /opt/aryazos/study-sync/out ./out
COPY --from=builder /opt/runtime/node_modules ./node_modules
COPY --from=builder /opt/runtime/package.json ./package.json

EXPOSE 3333

CMD ["node", "out/server/aryazos-study-sync-server.js"]
