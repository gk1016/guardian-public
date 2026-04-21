# ---- Builder ----
FROM rust:1.86-bookworm AS builder

WORKDIR /app

# Cache dependencies: copy manifests first
COPY Cargo.toml Cargo.lock* ./
RUN mkdir src && echo 'fn main() {}' > src/main.rs
RUN cargo build --release 2>/dev/null || true

# Copy real source and build
COPY src/ src/
RUN touch src/main.rs && cargo build --release

# ---- Runtime ----
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/guardian-engine /usr/local/bin/guardian-engine

EXPOSE 3420 3421

ENTRYPOINT ["guardian-engine"]
