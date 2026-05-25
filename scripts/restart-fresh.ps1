# Stop whatever listens on port 3000, rebuild, and start Next.js production server.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "Stopping processes on port 3000..."
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 2

Write-Host "Building..."
pnpm build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Starting (pnpm start)..."
pnpm start
