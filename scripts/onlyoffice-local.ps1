# Start OnlyOffice Document Server for local KIAS dev (port 8082).
# Requires Docker Desktop to be Running.

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "Checking Docker..." -ForegroundColor Cyan
docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Docker Desktop is not running." -ForegroundColor Red
    Write-Host "1. Open Docker Desktop from Start menu"
    Write-Host "2. Wait until status shows Running"
    Write-Host "3. Run again: pnpm onlyoffice:up"
    exit 1
}

Write-Host "Starting OnlyOffice (recreate to apply env changes)..." -ForegroundColor Cyan
docker compose -f docker-compose.onlyoffice.local.yml up -d --force-recreate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Waiting for healthcheck..." -ForegroundColor Cyan
$max = 60
for ($i = 1; $i -le $max; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:8082/healthcheck" -UseBasicParsing -TimeoutSec 3
        if ($r.Content.Trim() -eq "true") {
            Write-Host ""
            Write-Host "OnlyOffice is ready: http://localhost:8082/healthcheck = true" -ForegroundColor Green
            Write-Host "Proxy kias-doc-proxy -> Next.js :3000 is up (REPORT_DOCUMENT_HOST_URL=http://kias-doc-proxy:8888)"
            Write-Host "Restart pnpm dev, buat report session BARU, lalu buka editor."
            exit 0
        }
    } catch {
        # still starting
    }
    Write-Host "  ... attempt $i/$max"
    Start-Sleep -Seconds 5
}

Write-Host ""
Write-Host "OnlyOffice container started but healthcheck not ready yet." -ForegroundColor Yellow
Write-Host "Check logs: docker compose -f docker-compose.onlyoffice.local.yml logs -f onlyoffice"
exit 1
