# Deploy Guardian Flight

## Requirements

- Docker + Docker Compose v2
- 2 GB+ RAM
- Ports 443 (HTTPS) and 3421 (engine federation) available

## Quick Start

```bash
git clone https://github.com/gk1016/guardian.git && cd guardian
cp .env.example .env
```

Edit `.env` — change `AUTH_SECRET` and `POSTGRES_PASSWORD` at minimum.
Update `DATABASE_URL` to match if you change the Postgres password.

```bash
docker compose --profile tools run guardian-tools
docker compose up -d
```

Open https://localhost and accept the self-signed certificate.

## Demo Credentials

Three users are created by the seed script, all sharing the password set in `GUARDIAN_DEMO_PASSWORD` (default: `GuardianDemo!2026`):

| Handle   | Email                    | Role               |
|----------|--------------------------|---------------------|
| REAPER11 | reaper11@guardian.local  | commander (org owner) |
| SABER1   | saber1@guardian.local    | pilot               |
| VIKING2  | viking2@guardian.local   | rescue_coordinator  |

## TLS and Custom Domain

Guardian uses Caddy for TLS. The default config generates a self-signed certificate for `localhost`.

**LAN access (e.g. 192.168.1.50):** Set `SITE_ADDRESS=192.168.1.50` in `.env`. Caddy will generate a self-signed cert for that IP. Clients will need to accept the browser warning.

**Custom port:** Set `HTTPS_PORT=3411` (or any port) in `.env`. Access at `https://yourhost:3411`.

**Public domain with Let's Encrypt:** Set `SITE_ADDRESS=guardian.example.com` in `.env`, then edit `Caddyfile` and remove the `tls internal` line. Caddy will auto-provision a certificate. Ports 80 and 443 must be reachable from the internet.

## Services

| Service           | Purpose                                  |
|-------------------|------------------------------------------|
| guardian          | Next.js frontend (internal port 3000)    |
| guardian-engine   | Rust compute sidecar (internal port 3420)|
| guardian-postgres | PostgreSQL 16                            |
| guardian-tools    | Runs DB migration + seed (one-shot)      |
| caddy             | Reverse proxy + TLS termination          |

## Federation

Engine federation (instance-to-instance mTLS) listens on host port 3421. This port is exposed directly — it does not go through Caddy.

## Reseed or Reset

To wipe the database and start fresh:

```bash
docker compose down
docker volume rm guardian_guardian-postgres-data
docker compose --profile tools run guardian-tools
docker compose up -d
```

## Troubleshooting

**"guardian-tools" exits immediately:** Check that postgres is healthy first. The tools service waits for the healthcheck, but if the postgres container itself failed to start, check `docker compose logs guardian-postgres`.

**Self-signed cert warning won't go away:** This is expected with `tls internal`. Import Caddy's root CA from the `caddy_data` volume if you want browsers to trust it, or switch to Let's Encrypt with a real domain.

**Engine WebSocket not connecting:** The frontend connects to `/engine/ws`. Verify Caddy is running (`docker compose logs caddy`) and that no firewall is blocking the HTTPS port.
