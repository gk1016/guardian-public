# Guardian Flight — Setup (Windows PowerShell)

Write-Host ""
Write-Host "  Guardian Flight - Setup"
Write-Host "  -----------------------"
Write-Host ""

# Check for Docker
try {
    $null = docker info 2>&1
} catch {
    Write-Host "  ERROR: Docker is not installed or not running."
    Write-Host "  Install Docker Desktop from https://www.docker.com/get-started/"
    exit 1
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Docker is not running."
    Write-Host "  Start Docker Desktop and try again."
    exit 1
}

# Generate .env if it doesn't exist
if (Test-Path .env) {
    Write-Host "  Found existing .env - keeping current configuration."
} else {
    Write-Host "  Generating configuration..."

    $authBytes = New-Object byte[] 32
    $pgBytes = New-Object byte[] 16
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($authBytes)
    $rng.GetBytes($pgBytes)
    $authSecret = [BitConverter]::ToString($authBytes) -replace '-','' | ForEach-Object { $_.ToLower() }
    $pgPass = [BitConverter]::ToString($pgBytes) -replace '-','' | ForEach-Object { $_.ToLower() }

    @"
DATABASE_URL=postgresql://guardian:${pgPass}@guardian-postgres:5432/guardian
POSTGRES_USER=guardian
POSTGRES_PASSWORD=${pgPass}
POSTGRES_DB=guardian
PORT=3000
NODE_ENV=production
AUTH_SECRET=${authSecret}
SITE_ADDRESS=localhost
HTTPS_PORT=443
BACKUP_INTERVAL_HOURS=24
BACKUP_RETENTION_DAYS=7
"@ | Set-Content -Path .env -Encoding UTF8

    Write-Host "  Configuration generated."
}

Write-Host ""
Write-Host "  Pulling container images..."
docker compose pull

Write-Host ""
Write-Host "  Initializing database..."
docker compose --profile init run --rm guardian-init

Write-Host ""
Write-Host "  Starting Guardian..."
docker compose up -d

Write-Host ""
Write-Host "  -----------------------"
Write-Host "  Guardian is running."
Write-Host ""
Write-Host "  Open https://localhost in your browser."
Write-Host "  (Accept the self-signed certificate warning - you're connecting to your own machine.)"
Write-Host ""
Write-Host "  The setup wizard will walk you through creating"
Write-Host "  your organization and admin account."
Write-Host "  -----------------------"
Write-Host ""
