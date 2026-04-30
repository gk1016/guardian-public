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

### 4. Start Guardian

```bash
docker compose up -d
```

The first time you run this, Docker will download base images and build the application. **This will take 5–15 minutes** depending on your internet speed and machine — the Rust engine compiles from source and the React SPA is built during the Docker build. You'll see build output in the logs.

The engine automatically creates the database tables on first boot. No separate migration step is needed.

### 5. Seed demo data (optional)

If you want the demo users (REAPER11, SABER1, VIKING2), sample org, and manual entries:

```bash
npm install --prefix prisma
npx --prefix prisma prisma db seed
```

You should see:

```
Guardian seed complete.
```

### 6. Open Guardian

Go to **https://localhost** in your browser.

You will see a security warning about the certificate — this is expected. Guardian generates a self-signed TLS certificate on first boot. To proceed:

- **Chrome:** Click "Advanced" then "Proceed to localhost (unsafe)"
- **Firefox:** Click "Advanced" then "Accept the Risk and Continue"
- **Safari:** Click "Show Details" then "visit this website"
- **Edge:** Click "Advanced" then "Continue to localhost (unsafe)"

This is safe — you're connecting to your own machine.

### 7. Log in

Use any of the demo accounts (if you ran the seed step):

| Handle   | Email                    | Role                  |
|----------|--------------------------|------------------------|
| REAPER11 | reaper11@guardian.local  | commander (org owner)  |
| SABER1   | saber1@guardian.local    | pilot                  |
| VIKING2  | viking2@guardian.local   | rescue_coordinator     |

The password for all three is `GuardianDemo!2026` (unless you changed `GUARDIAN_DEMO_PASSWORD` in `.env`).

## TLS Configuration

Guardian's engine handles TLS directly — there is no reverse proxy. TLS mode is controlled by the `TLS_MODE` variable in `.env`.

**Self-signed (default):**

No configuration needed. The engine generates a self-signed certificate for `SITE_ADDRESS` (default: `localhost`) on first boot. Browsers will show a certificate warning.

**Access from another device on your LAN (e.g. 192.168.1.50):**

Set `SITE_ADDRESS=192.168.1.50` in `.env` and restart with `docker compose up -d`. Other devices on your network can then access `https://192.168.1.50`. They will see the same certificate warning — click through it.

**Use a different port (e.g. 3411):**

Set `HTTPS_PORT=3411` in `.env` and restart. Access at `https://localhost:3411`.

**Automatic Let's Encrypt (ACME):**

Set the following in `.env`:

```
TLS_MODE=acme
SITE_ADDRESS=guardian.example.com
ACME_EMAIL=you@example.com
ACME_PRODUCTION=true
```

The engine will automatically obtain and renew a certificate from Let's Encrypt using TLS-ALPN-01 validation. Your server must be reachable from the internet on ports 443 (HTTPS) and 80 (HTTP redirect). Certificates are stored in a Docker volume and persist across restarts.

Set `ACME_PRODUCTION=false` (the default) to use Let's Encrypt's staging environment for testing.

**Manual certificate:**

Set `TLS_MODE=manual` and mount your certificate and key files into the engine container at the paths specified in `GUARDIAN_CERT_DIR`.

## Services

Guardian runs three Docker containers:

| Container         | What it does                                                    |
|-------------------|-----------------------------------------------------------------|
| guardian-engine   | The entire application — TLS proxy, SPA host, REST API, compute engine, WebSocket, federation listener |
| guardian-postgres | The database (PostgreSQL 16)                                    |
| guardian-backup   | Sidecar that runs automated `pg_dump` backups (default: every 24h, 7-day retention) |

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
docker compose up -d
# Wait for engine to create tables, then re-seed:
npm install --prefix prisma
npx --prefix prisma prisma db seed
```

Note: the volume name includes your project directory name. If you cloned into a different folder, replace `guardian-public` with that folder name.

## Troubleshooting

**Build fails or takes forever:**
The Rust engine compiles from source, which is CPU-intensive. On a low-powered machine, the first build can take 20+ minutes. Subsequent builds use Docker layer caching and are much faster.

**Can't connect after starting:**
Wait 10–15 seconds after `docker compose up -d`. Check that all containers are running: `docker compose ps`. You should see `guardian-engine`, `guardian-postgres`, and `guardian-backup` all showing "Up".

**Certificate warning on every visit:**
This is expected with self-signed certificates. To eliminate it, either use Let's Encrypt with a real domain (`TLS_MODE=acme`), or extract the self-signed CA from the `guardian-engine-certs` Docker volume and import it into your browser's trust store.

**Engine not starting — "database connection" errors:**
The engine waits for PostgreSQL to be healthy before starting, but if the database is slow to initialize on first boot, the engine may retry. Check logs with `docker compose logs guardian-engine`. You should see "external HTTPS listener ready" when it's fully up.

**WebSocket not connecting:**
The status bar in the app may show "Engine: disconnected". Check that the engine is running: `docker compose logs guardian-engine`. You should see "external HTTPS listener ready" and periodic "compute tick complete" messages.

**Port 443 already in use:**
Set `HTTPS_PORT=3411` (or any available port) in `.env` and restart. Access Guardian at `https://localhost:3411`.
