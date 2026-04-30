# Guardian Flight

A self-hosted operational platform for Star Citizen organizations. Mission planning, QRF posture, CSAR intake, threat intelligence, tactical comms, doctrine, and briefing workflows — all in one place.

## Quick Deploy

Requires [Docker Desktop](https://www.docker.com/get-started/) and [Git](https://git-scm.com/downloads). See [DEPLOY.md](DEPLOY.md) for full step-by-step instructions with screenshots and troubleshooting.

```bash
git clone https://github.com/gk1016/guardian-public.git
cd guardian-public
cp .env.example .env
# Edit .env — change AUTH_SECRET, POSTGRES_PASSWORD, and DATABASE_URL
docker compose up -d
```

The engine runs database migrations automatically on first boot. To seed demo data (demo users, sample org, manual entries):

```bash
npm install --prefix prisma
npx --prefix prisma prisma db seed
```

Open https://localhost (or your configured `SITE_ADDRESS`), accept the self-signed cert, and log in with `reaper11@guardian.local` / `GuardianDemo!2026`.

## What's Inside

### Compute Engine (Rust)

The engine (`guardian-engine`) is the core of Guardian. It handles everything:

- **TLS termination** — self-signed, manual cert, or automatic Let's Encrypt (ACME TLS-ALPN-01). No reverse proxy needed.
- **Static SPA hosting** — serves the compiled React frontend from embedded assets.
- **API server** — all REST endpoints for auth, missions, fleet, intel, comms, admin, and more.
- **WebSocket** — real-time ops summary push to all connected browsers.
- **Compute loop** — every 30 seconds, queries the database for active missions, open rescues, QRF status, and intel reports. Runs threat correlation, evaluates alert rules, generates notifications, and broadcasts results.
- **Federation** — multiple Guardian instances can connect over mTLS (port 3421) to share threat data, intel reports, and comms messages across orgs.
- **Database migrations** — automatically applied on startup. No separate migration step required.

### Web Application (Vite React SPA)

The frontend is a single-page application built with Vite and React Router. It is compiled at Docker build time and served by the engine as static assets.

- Watch Floor / Command Deck with real-time engine status and ops summary
- Mission Board — full lifecycle from planning through AAR, with template seeding and participant roster
- QRF Readiness Board with dispatch tracking
- CSAR (rescue) intake, assignment, and outcome logging
- Intelligence system — NATO-standard reliability ratings, threat actor profiles, PIR/IR/RFI tracking, AI-assisted analysis, and F3EAD/D3A targeting pipeline
- Tactical comms — encrypted channels with real-time messaging, auto-channels for CSAR/QRF events, federation bridge for cross-org messaging
- Doctrine templates and ROE management with full CRUD
- Incident tracking with lessons learned and action items
- Notification system with configurable alert rules
- Fleet management with ship specs synced from UEX Corp API
- Roster and org member management
- Admin panel for user, org, and AI model administration
- Light/dark theme support with CSS variable theming throughout

### Infrastructure

- **PostgreSQL 16** — all persistent data (users, orgs, missions, intel, comms, fleet, etc.)
- **Automated backups** — a sidecar container runs `pg_dump` on a configurable interval (default: every 24 hours, 7-day retention)
- **Docker Compose** — three services defined in one file, one command to start

## Architecture

```
Browser
  │
  ├── HTTPS ──→ Engine (:443)
  │               ├── /* ──────────→ Static SPA assets
  │               ├── /api/* ──────→ REST API handlers
  │               └── /api/ws ─────→ WebSocket (ops push)
  │
  └── WSS ───→ Engine (:443)
                  └── /api/comms/ws → Comms WebSocket (real-time messaging)

Engine (:3421) ←──mTLS──→ Federated Engine (:3421)
```

All traffic goes directly to the engine. There is no reverse proxy. The engine handles TLS termination, static file serving, API routing, and WebSocket upgrades. Federation traffic uses a separate mTLS listener on port 3421 with its own certificate chain.

## Demo Credentials

| Handle   | Email                    | Role                  |
|----------|--------------------------|------------------------|
| REAPER11 | reaper11@guardian.local  | commander (org owner)  |
| SABER1   | saber1@guardian.local    | pilot                  |
| VIKING2  | viking2@guardian.local   | rescue_coordinator     |

Default password for all: `GuardianDemo!2026` (override with `GUARDIAN_DEMO_PASSWORD` in `.env`)

## Stack

- **Frontend:** Vite, React 19, React Router, TanStack Query, TypeScript, Tailwind CSS 4
- **Backend:** Rust, tokio, axum, sqlx, rustls
- **Database:** PostgreSQL 16
- **Auth:** JWT (HS256, httpOnly cookies, 7-day sessions, bcrypt password hashing)
- **TLS:** rustls with self-signed, manual, or ACME (Let's Encrypt) modes
- **Containerization:** Docker Compose v2

## Services

Guardian runs three Docker containers (plus an optional tools container for seeding):

| Container         | What it does                                                    |
|-------------------|-----------------------------------------------------------------|
| guardian-engine   | The entire application — TLS proxy, SPA host, API server, compute engine, WebSocket, federation listener |
| guardian-postgres | The database (PostgreSQL 16)                                    |
| guardian-backup   | Sidecar that runs automated pg_dump backups on a schedule       |

## Configuration

All configuration is in `.env`. Key variables:

| Variable | Purpose |
|----------|---------------------------------------------|
| `AUTH_SECRET` | Signs JWT login tokens. Must be unique per instance. |
| `POSTGRES_PASSWORD` | Database password. Must match the password in `DATABASE_URL`. |
| `SITE_ADDRESS` | Hostname for TLS cert generation and CORS. Default: `localhost`. |
| `TLS_MODE` | `self-signed`, `manual`, `acme`, or `none`. Default: `self-signed`. |
| `HTTPS_PORT` | HTTPS listen port. Default: `443`. |
| `ACME_EMAIL` | Contact email for Let's Encrypt (only used with `TLS_MODE=acme`). |
| `BACKUP_INTERVAL_HOURS` | Hours between automated database backups. Default: `24`. |
| `BACKUP_RETENTION_DAYS` | Days to keep backup files before pruning. Default: `7`. |

See `.env.example` for the full list with detailed comments.

## Local Development

To develop on Guardian you need Rust 1.75+, Node.js 22+, and a running PostgreSQL instance.

**Frontend (SPA):**

```bash
cd guardian-spa
npm install
npx vite dev
```

The Vite dev server runs at http://localhost:5173 and proxies API calls to the engine.

**Backend (Engine):**

```bash
cd guardian-engine
cargo run
```

The engine listens on port 3420 (internal HTTP) by default. Set `DATABASE_URL` in your environment before starting.

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).

Copyright (C) 2026 Boring Tech Stuff LLC
