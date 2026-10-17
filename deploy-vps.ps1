# FluencyAI One-Click VPS Production Deploy Script
# Deploys built static PWA to Ra Server (/opt/fluencyai/dist)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " 🚀 Building FluencyAI Production Bundle  " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$ErrorActionPreference = "Stop"

# 1. Typecheck and Vite Build
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed! Aborting deployment."
    exit 1
}

# 2. Deploy to Ra VPS via SCP
Write-Host "`n📡 Uploading to Ra VPS ('192.168.1.28:/opt/fluencyai/dist')..." -ForegroundColor Yellow
scp -r -o BatchMode=yes dist/. viguru@192.168.1.28:/opt/fluencyai/dist/
if ($LASTEXITCODE -ne 0) {
    Write-Error "SCP upload failed! Check SSH connectivity to Ra server."
    exit 1
}

# 3. Fix permissions and reload Nginx
Write-Host "🔧 Setting server permissions and reloading Nginx..." -ForegroundColor Yellow
ssh viguru@192.168.1.28 "sudo chmod -R 755 /opt/fluencyai && sudo systemctl reload nginx"

Write-Host "`n✅ DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "🌐 Live Global URL: https://api.cosmowhisper.com/fluency/" -ForegroundColor Green
Write-Host "🌐 Subdomain (when DNS active): https://fluency.cosmowhisper.com" -ForegroundColor Green
