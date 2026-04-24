# Guardian Flight

A self-hosted operational platform for Star Citizen organizations. Mission planning, QRF posture, CSAR intake, threat intelligence, doctrine, and briefing workflows — all in one place.

## Quick Deploy

Requires [Docker Desktop](https://www.docker.com/get-started/) and [Git](https://git-scm.com/downloads). See [DEPLOY.md](DEPLOY.md) for full step-by-step instructions and troubleshooting.

```bash
git clone https://github.com/gk1016/guardian-public.git
cd guardian-public
cp .env.example .env
# Edit .env — change AUTH_SECRET, POSTGRES_PASSWORD, and DATABASE_URL
docker compose pull
docker compose --profile tools run guardian-tools   # seeds the database
docker compose up -d
```

Open https://localhost, accept the self-signed cert, and log in with `reaper11@guardian.local` / `GuardianDemo!2026`.

## Container Images

Pre-built images are published to GitHub Container Registry:

| Image | Description |
|-------|-------------|
| `ghcr.io/gk1016/guardian-flight` | Next.js web application |
| `ghcr.io/gk1016/guardian-engine` | Rust compute engine |

No build step required — `docker compose pull` downloads everything.

## What's Inside

### Web Application (Next.js 16)

The frontend and API layer. Handles all pages, authentication, and database access via Prisma ORM.

- Watch Floor / Command Deck with real-time engine status
- Mission Board — full lifecycle from planning through AAR
- QRF Readiness Board with dispatch tracking
- CSAR (rescue) intake, assignment, and outcome logging
- Intel reporting with severity, confidence, and threat correlation
- Doctrine templates and ROE management
- Incident tracking with lessons learned and action items
- Notification system with configurable alert rules
- Roster and org member management
- Admin panel for user and org administration

### Compute Engine (Rust)

A standalone Rust binary (`guardian-engine`) that runs alongside the web app. Every 30 seconds it:

1. Queries the database for active missions, open rescues, QRF status, and intel reports
2. Runs threat correlation — matches hostile sightings against active operations
3. Evaluates alert rules and generates notifications when thresholds are hit
4. Builds an ops summary snapshot
5. Broadcasts the results to all connected browsers via WebSocket

The engine also supports federation — multiple Guardian instances can connect to each other over mTLS to share threat data across orgs.

### Infrastructure

- **PostgreSQL 16** — all persistent data (users, orgs, missions, intel, etc.)
- **Caddy** — reverse proxy with automatic TLS. Self-signed certs by default, or Let's Encrypt for public domains.
- **Docker Compose** — all five services defined in one file, one command to start

## Architecture

```
Browser
  │
  ├── HTTPS ──→ Caddy (:443)
  │               ├── /* ──────→ Next.js (:3000) ──→ PostgreSQL
  │               └── /engine/* ──→ Engine (:3420)
  │
  └── WSS ───→ Caddy (:443)
                  └── /engine/ws ──→ Engine (:3420) WebSocket
```

All traffic goes through Caddy. The frontend and engine are not directly exposed to the network. Federation (engine-to-engine mTLS on port 3421) is the one exception — it bypasses Caddy because it uses its own TLS certificates.

## Demo Credentials

| Handle   | Email                    | Role                  |
|----------|--------------------------|------------------------|
| REAPER11 | reaper11@guardian.local  | commander (org owner)  |
| SABER1   | saber1@guardian.local    | pilot                  |
| VIKING2  | viking2@guardian.local   | rescue_coordinator     |

Default password for all: `GuardianDemo!2026` (override with `GUARDIAN_DEMO_PASSWORD` in `.env`)

## Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Backend:** Next.js API routes, Prisma ORM
- **Engine:** Rust, tokio, axum, sqlx, rustls
- **Database:** PostgreSQL 16
- **Auth:** JWT (HS256, httpOnly cookies, 7-day sessions, bcrypt password hashing)
- **Proxy:** Caddy 2 (Alpine)
- **Containerization:** Docker Compose v2
- **Registry:** GitHub Container Registry (ghcr.io)

## Local Development

If you want to develop on Guardian rather than just deploy it, you need Node.js 22+ and a running PostgreSQL instance.

```bash
npm install
cp .env.example .env
# Edit DATABASE_URL in .env to point to your local Postgres
npx prisma db push
npm run db:seed
npm run dev
```

The dev server runs at http://localhost:3000. The Rust engine is not started by `npm run dev` — if you need it, build and run it separately from the `guardian-engine/` directory with `cargo run`.

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).

Copyright (C) 2026 Boring Tech Stuff LLC
