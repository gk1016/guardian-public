# Guardian

Guardian is a standalone operational platform for a Star Citizen org built around:

- mission planning
- QRF posture
- CSAR intake and dispatch
- threat and target intelligence
- doctrine, ROE, and briefing workflows

This repository is intentionally separate from Cloud Core. It borrows useful operational concepts without inheriting Cloud Core's consumer-product scope.

## Stack

- Next.js 16
- TypeScript
- Tailwind CSS 4
- Prisma
- PostgreSQL
- Docker Compose

## Current Bootstrap Scope

This first slice includes:

- public landing page
- authenticated-side command deck shell
- health endpoint
- Docker and Postgres scaffolding
- initial Prisma schema for org, mission, intel, and rescue workflows

Not implemented yet:

- auth
- role-based access control
- live mission CRUD
- real-time dispatch sync
- production data wiring

## Local Development

```bash
npm install
cp .env.example .env
npm run dev
```

App URL:

- `http://localhost:3000`

Health endpoint:

- `http://localhost:3000/api/health`

## Database

Generate Prisma client:

```bash
npm run db:generate
```

Push schema to a local database:

```bash
npm run db:push
```

## Docker

Build and run:

```bash
docker compose up --build
```

Default services:

- Guardian web app on `127.0.0.1:3400`
- PostgreSQL on `127.0.0.1:5441`

## Deployment Intent

Guardian is meant to deploy as its own Dockerized application on `nucbox` with:

- its own repository
- its own database
- its own hostname
- no runtime coupling to Cloud Core
