# English Tutor Blue-Green Production Deployment & Version Switcher
# Usage:
#   .\deploy-tutor.ps1 -Target v1     # Deploys fresh build to Version 1 (Stable)
#   .\deploy-tutor.ps1 -Target v2     # Deploys fresh build to Version 2 (Staging / Playground)
#   .\deploy-tutor.ps1 -Swap          # Instantly swaps the active production version between V1 and V2
#   .\deploy-tutor.ps1 -Status        # Displays current active version on the server

param (
    [ValidateSet("v1", "v2", "swap", "status")]
    [string]$Target = "v1",
    [switch]$Swap,
    [switch]$Status
)

$ErrorActionPreference = "Stop"

if ($Status) {
    $current = ssh viguru@192.168.1.28 "readlink -f /opt/eng-tutor/active"
    Write-Host "`n=======================================================" -ForegroundColor Cyan
    Write-Host " [STATUS] English Tutor Live Architecture" -ForegroundColor Cyan
    Write-Host "=======================================================" -ForegroundColor Cyan
    Write-Host " Currently Active Link: $current" -ForegroundColor Green
    Write-Host " Main Live URL:         https://api.cosmowhisper.com/tutor/" -ForegroundColor Green
    Write-Host " Version 1 Direct:      https://api.cosmowhisper.com/tutor/v1/" -ForegroundColor White
    Write-Host " Version 2 Direct:      https://api.cosmowhisper.com/tutor/v2/" -ForegroundColor White
    exit 0
}

if ($Swap -or $Target -eq "swap") {
    Write-Host "`n[SWAP] Checking current active version on Ra VPS..." -ForegroundColor Yellow
    $current = ssh viguru@192.168.1.28 "readlink -f /opt/eng-tutor/active"
    $newTarget = if ($current -match "v1") { "v2" } else { "v1" }

    Write-Host "[SWAP] Swapping active version from $(Split-Path $current -Leaf) -> $newTarget..." -ForegroundColor Yellow
    ssh viguru@192.168.1.28 "sudo ln -sfn /opt/eng-tutor/$newTarget /opt/eng-tutor/active && sudo systemctl reload nginx"

    Write-Host "`n[SUCCESS] SWAP COMPLETE!" -ForegroundColor Green
    Write-Host "Active Version is now: $newTarget" -ForegroundColor Green
    Write-Host "Live Main URL: https://api.cosmowhisper.com/tutor/ (Serving $newTarget)" -ForegroundColor Green
    exit 0
}

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " Building English Tutor Production Bundle for $Target  " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# 1. Typecheck and Vite Build
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed! Aborting deployment."
    exit 1
}

# 2. Package into tar.gz
Write-Host "`n[1/3] Packaging bundle into tar.gz archive..." -ForegroundColor Yellow
tar -czf dist.tar.gz -C dist .
if ($LASTEXITCODE -ne 0) {
    Write-Error "Tar archive packaging failed!"
    exit 1
}

# 3. Upload archive to Ra VPS
Write-Host "[2/3] Uploading bundle to Ra VPS..." -ForegroundColor Yellow
scp -o BatchMode=yes dist.tar.gz viguru@192.168.1.28:/tmp/eng_tutor_dist.tar.gz
Remove-Item dist.tar.gz -Force -ErrorAction SilentlyContinue

# 4. Extract on server into /opt/eng-tutor/$Target/dist and fix permissions
Write-Host "[3/3] Extracting on server into /opt/eng-tutor/$Target/dist..." -ForegroundColor Yellow
ssh viguru@192.168.1.28 "sudo mkdir -p /opt/eng-tutor/$Target/dist && sudo rm -rf /opt/eng-tutor/$Target/dist/* && sudo tar -xzf /tmp/eng_tutor_dist.tar.gz -C /opt/eng-tutor/$Target/dist/ && rm /tmp/eng_tutor_dist.tar.gz && sudo chmod -R 755 /opt/eng-tutor/$Target && sudo systemctl reload nginx"

$current = ssh viguru@192.168.1.28 "readlink -f /opt/eng-tutor/active"
$activeVersion = Split-Path $current -Leaf

Write-Host "`n[OK] DEPLOYMENT COMPLETE TO $Target!" -ForegroundColor Green
Write-Host "Direct $Target URL:     https://api.cosmowhisper.com/tutor/$Target/" -ForegroundColor Green
Write-Host "Current Active Version: $activeVersion (Serves https://api.cosmowhisper.com/tutor/)" -ForegroundColor Cyan
Write-Host "To swap active version: .\deploy-tutor.ps1 -Swap" -ForegroundColor Yellow
