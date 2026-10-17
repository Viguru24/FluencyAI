# Fluency AI One-Click VPS Production Deploy Script
# Deploys built static PWA to Ra Server (/opt/fluencyai/dist)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Building Fluency AI Production Bundle    " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$ErrorActionPreference = "Stop"

# 1. Typecheck and Vite Build
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed! Aborting deployment."
    exit 1
}

# 2. Package into tar.gz for atomic, recursive upload
Write-Host "`n[1/3] Packaging bundle into tar.gz archive..." -ForegroundColor Yellow
tar -czf dist.tar.gz -C dist .
if ($LASTEXITCODE -ne 0) {
    Write-Error "Tar archive packaging failed!"
    exit 1
}

# 3. Upload archive to Ra VPS
Write-Host "[2/3] Uploading archive to Ra VPS (192.168.1.28)..." -ForegroundColor Yellow
scp -o BatchMode=yes dist.tar.gz viguru@192.168.1.28:/tmp/fluencyai_dist.tar.gz
if ($LASTEXITCODE -ne 0) {
    Remove-Item dist.tar.gz -Force -ErrorAction SilentlyContinue
    Write-Error "SCP upload failed! Check SSH connectivity to Ra server."
    exit 1
}
Remove-Item dist.tar.gz -Force -ErrorAction SilentlyContinue

# 4. Extract on server, fix permissions and reload Nginx
Write-Host "[3/3] Extracting on server and reloading Nginx..." -ForegroundColor Yellow
ssh viguru@192.168.1.28 "rm -rf /opt/fluencyai/dist/* && tar -xzf /tmp/fluencyai_dist.tar.gz -C /opt/fluencyai/dist/ && rm /tmp/fluencyai_dist.tar.gz && sudo chmod -R 755 /opt/fluencyai && sudo systemctl reload nginx"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Remote extraction or Nginx reload failed!"
    exit 1
}

Write-Host "`n[OK] DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "Live Global URL: https://api.cosmowhisper.com/fluency/" -ForegroundColor Green
Write-Host "Subdomain:       https://fluency.cosmowhisper.com" -ForegroundColor Green
