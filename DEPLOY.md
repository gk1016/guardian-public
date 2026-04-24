# Deploy Guardian Flight

## What You Need

- **Docker Desktop** — download and install from [docker.com/get-started](https://www.docker.com/get-started/). This includes Docker Compose. After installing, open Docker Desktop and make sure it says "Engine Running" in the bottom left.
- **Git** — download from [git-scm.com](https://git-scm.com/downloads) if you don't already have it.
- **A machine with 2 GB+ RAM** — any modern laptop or server will do.
- **Ports 443 and 3421 available** — if something else is using port 443, you can change it (see TLS section below).

## Step by Step

### 1. Clone the repo

Open a terminal (Terminal on Mac/Linux, PowerShell on Windows) and run:

```bash
git clone https://github.com/gk1016/guardian-public.git
cd guardian-public
```

### 2. Create your config file

```bash
cp .env.example .env
```

This copies the example config to a file called `.env` that Guardian will actually read.

### 3. Edit `.env`

Open `.env` in any text editor (VS Code, Notepad, nano, whatever you have). You need to change at least two values:

**AUTH_SECRET** — change this to any random string. This is used to sign login tokens. Example:

```
AUTH_SECRET=my-guardian-instance-2026-xk9m
```

**POSTGRES_PASSWORD** — change this to a password of your choosing. Example:

```
POSTGRES_PASSWORD=my-secure-db-password
```

**Important:** if you change `POSTGRES_PASSWORD`, you must also update the password inside `DATABASE_URL` to match. The format is:

```
DATABASE_URL=postgresql://guardian:YOUR_PASSWORD_HERE@guardian-postgres:5432/guardian
```

So if you set `POSTGRES_PASSWORD=my-secure-db-password`, your DATABASE_URL should be:

```
DATABASE_URL=postgresql://guardian:my-secure-db-password@guardian-postgres:5432/guardian
```

Everything else can stay at the defaults. See the comments in `.env.example` for what each variable does.

### 4. Pull images and seed the database

```bash
docker compose pull
docker compose --profile tools run guardian-tools
```

Docker will download the pre-built images from GitHub Container Registry. This should take 1-3 minutes depending on your internet speed. Wait until you see:

```
Guardian seed complete.
```

That means the database is set up and loaded with demo data.

### 5. Start Guardian

```bash
docker compose up -d
```

This starts all services in the background. Give it about 10 seconds to fully boot.

### 6. Open Guardian

Go to **https://localhost** in your browser.

You will see a security warning about the certificate — this is expected. Guardian generates a self-signed TLS certificate on first boot. To proceed:

- **Chrome:** Click "Advanced" then "Proceed to localhost (unsafe)"
- **Firefox:** Click "Advanced" then "Accept the Risk and Continue"
- **Safari:** Click "Show Details" then "visit this website"
- **Edge:** Click "Advanced" then "Continue to localhost (unsafe)"

This is safe — you're connecting to your own machine.

### 7. Log in

Use any of the demo accounts:

| Handle   | Email                    | Role                  |
|----------|--------------------------|------------------------|
| REAPER11 | reaper11@guardian.local  | commander (org owner)  |
| SABER1   | saber1@guardian.local    | pilot                  |
| VIKING2  | viking2@guardian.local   | rescue_coordinator     |

The password for all three is `GuardianDemo!2026` (unless you changed `GUARDIAN_DEMO_PASSWORD` in `.env`).

## TLS and Custom Domain

Guardian uses Caddy for TLS. The default config generates a self-signed certificate for `localhost`.

**Access from another device on your LAN (e.g. 192.168.1.50):**

Set `SITE_ADDRESS=192.168.1.50` in `.env` and restart with `docker compose up -d`. Other devices on your network can then access `https://192.168.1.50`. They will see the same certificate warning — click through it.

**Use a different port (e.g. 3411):**

Set `HTTPS_PORT=3411` in `.env` and restart. Access at `https://localhost:3411`.

**Public domain with automatic Let's Encrypt:**

Set `SITE_ADDRESS=guardian.example.com` in `.env`, then edit the `Caddyfile` in the repo root and remove the `tls internal` line. Caddy will automatically get a real certificate from Let's Encrypt. Your server must be reachable from the internet on ports 80 and 443.

## Services

Guardian runs five Docker containers:

| Container         | What it does                                                    |
|-------------------|-----------------------------------------------------------------|
| guardian          | The web application (Next.js) — serves all pages and API routes |
| guardian-engine   | Rust sidecar that runs threat correlation, alert generation, and ops summary every 30 seconds, then pushes updates to browsers via WebSocket |
| guardian-postgres | The database (PostgreSQL 16)                                    |
| guardian-tools    | One-shot container that creates database tables and seeds demo data — only runs when you explicitly start it |
| caddy             | Reverse proxy that handles HTTPS and routes traffic to the frontend and engine |

## Updating

To pull the latest version:

```bash
docker compose pull
docker compose up -d
```

Docker will download any updated images and restart the affected containers. Your data is preserved in Docker volumes.

## Stopping and Starting

Stop everything:

```bash
docker compose down
```

Start again (data is preserved):

```bash
docker compose up -d
```

## Reset to Factory

To wipe the database and start completely fresh:

```bash
docker compose down
docker volume rm guardian-public_guardian-postgres-data
docker compose --profile tools run guardian-tools
docker compose up -d
```

Note: the volume name includes your project directory name. If you cloned into a different folder, replace `guardian-public` with that folder name.

## Troubleshooting

**Images fail to pull:**
The container images are hosted on GitHub Container Registry (ghcr.io). If you're behind a corporate firewall or proxy, make sure `ghcr.io` is not blocked.

**Can't connect after starting:**
Wait 10-15 seconds after `docker compose up -d`. Check that all containers are running: `docker compose ps`. All five should show "Up" (guardian-tools will show "Exited" — that's normal, it only runs once).

**Certificate warning on every visit:**
This is expected with self-signed certificates. To eliminate it, either use Let's Encrypt with a real domain, or import Caddy's root CA from the `caddy_data` Docker volume into your browser's trust store.

**Engine WebSocket not connecting:**
The status bar in the app may show "Engine: disconnected". Check that the engine is running: `docker compose logs guardian-engine`. You should see "listening addr=0.0.0.0:3420" and periodic "compute tick complete" messages.
