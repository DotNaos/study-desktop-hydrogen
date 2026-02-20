FROM oven/bun:1 AS builder
WORKDIR /app

# Copy workspace config
COPY package.json bun.lock* ./

# Copy shared packages
COPY shared/ ./shared/

# Copy app source
COPY apps/study/study-web/package.json ./apps/study/study-web/
COPY apps/study/study-web/ ./apps/study/study-web/

# Install from root to link workspaces
WORKDIR /app/apps/study/study-web
RUN cd ../../.. && bun install

# Build args
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_BASE
ENV VITE_BASE=$VITE_BASE

# Build frontend
RUN bun run build

FROM oven/bun:1 AS release
WORKDIR /app

# Copy built assets and server code
COPY --from=builder /app/apps/study/study-web/build/client ./build/client
COPY --from=builder /app/apps/study/study-web/server ./server
COPY --from=builder /app/apps/study/study-web/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Create data directory for SQLite
RUN mkdir -p data

EXPOSE 3000

ENV NODE_ENV=production
ENV DB_PATH=data/study.db

CMD ["bun", "run", "server/index.ts"]

