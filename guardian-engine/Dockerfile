# ---- SPA Builder ----
FROM node:22-bookworm-slim AS spa-builder
WORKDIR /spa
COPY guardian-spa/package.json guardian-spa/package-lock.json ./
RUN npm ci
COPY guardian-spa/ ./
RUN npx vite build

# ---- Rust Builder ----
FROM rust:1.95 AS builder

WORKDIR /app

# Cache dependencies: copy manifests first
COPY guardian-engine/Cargo.toml guardian-engine/Cargo.lock* ./
COPY guardian-engine/comms/Cargo.toml comms/Cargo.toml
RUN mkdir src && echo 'fn main() {}' > src/main.rs
RUN mkdir -p comms/src && echo '' > comms/src/lib.rs
RUN cargo build --release 2>/dev/null || true

# Copy real source and migrations, then build
COPY guardian-engine/src/ src/
COPY guardian-engine/comms/src/ comms/src/
COPY guardian-engine/migrations/ migrations/
RUN touch src/main.rs comms/src/lib.rs && cargo build --release

# ---- Runtime ----
FROM debian:trixie-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create data directory for cert storage
RUN mkdir -p /data/guardian/certs

# SPA static assets
COPY --from=spa-builder /spa/dist /app/spa

COPY --from=builder /app/target/release/guardian-engine /usr/local/bin/guardian-engine

EXPOSE 3420 3421

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --spider -q http://127.0.0.1:3420/health || exit 1

ENTRYPOINT ["guardian-engine"]
