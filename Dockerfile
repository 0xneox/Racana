# Multi-stage Dockerfile for Manuscript In, Book Out

FROM node:18-alpine AS base
RUN apk add --no-cache libc6-compat curl bash
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps || npm install

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# Runner stage
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install Typst binary for typesetting engine
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then TYPST_ARCH="x86_64-unknown-linux-musl"; \
    elif [ "$ARCH" = "aarch64" ]; then TYPST_ARCH="aarch64-unknown-linux-musl"; \
    else TYPST_ARCH="x86_64-unknown-linux-musl"; fi && \
    curl -fsSL "https://github.com/typst/typst/releases/download/v0.11.1/typst-${TYPST_ARCH}.tar.xz" | tar -xJ && \
    mv "typst-${TYPST_ARCH}/typst" /usr/local/bin/ && \
    rm -rf "typst-${TYPST_ARCH}" || true

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
