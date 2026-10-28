# English Tutor (Eng Tutor) One-Click VPS Production Deploy Script
# NOTE: English Tutor and Fluency are separate projects. Do not target /opt/fluencyai.
# Deploys built static bundle to Ra Server (/opt/eng-tutor/dist)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Building English Tutor Production Bundle " -ForegroundColor Cyan
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
scp -o BatchMode=yes dist.tar.gz viguru@192.168.1.28:/tmp/eng_tutor_dist.tar.gz
if ($LASTEXITCODE -ne 0) {
    Remove-Item dist.tar.gz -Force -ErrorAction SilentlyContinue
    Write-Error "SCP upload failed! Check SSH connectivity to Ra server."
    exit 1
}
Remove-Item dist.tar.gz -Force -ErrorAction SilentlyContinue

# 4. Extract on server into /opt/eng-tutor/dist, fix permissions
Write-Host "[3/3] Extracting on server into /opt/eng-tutor/dist..." -ForegroundColor Yellow
ssh viguru@192.168.1.28 "sudo mkdir -p /opt/eng-tutor/dist && sudo chown -R viguru:viguru /opt/eng-tutor && rm -rf /opt/eng-tutor/dist/* && tar -xzf /tmp/eng_tutor_dist.tar.gz -C /opt/eng-tutor/dist/ && rm /tmp/eng_tutor_dist.tar.gz && sudo chmod -R 755 /opt/eng-tutor"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Remote extraction failed!"
    exit 1
}

Write-Host "`n[OK] ENGLISH TUTOR DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "Server directory: /opt/eng-tutor/dist" -ForegroundColor Green
