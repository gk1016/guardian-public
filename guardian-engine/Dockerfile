# ---- Builder ----
FROM rust:1.95 AS builder

WORKDIR /app

# Cache dependencies: copy manifests first
COPY Cargo.toml Cargo.lock* ./
RUN mkdir src && echo 'fn main() {}' > src/main.rs
RUN cargo build --release 2>/dev/null || true

# Copy real source and migrations, then build
COPY src/ src/
COPY migrations/ migrations/
RUN touch src/main.rs && cargo build --release

# ---- Runtime ----
FROM debian:trixie-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create data directory for cert storage
RUN mkdir -p /data/guardian/certs

COPY --from=builder /app/target/release/guardian-engine /usr/local/bin/guardian-engine

EXPOSE 3420 3421

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --spider -q http://127.0.0.1:3420/health || exit 1

ENTRYPOINT ["guardian-engine"]
