# Complete reset script for ClientFlow
# This will stop all processes, clear all caches, and restart fresh

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ClientFlow Complete Reset Script" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Kill all Node.js processes
Write-Host "[1/6] Stopping all Node.js processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Write-Host "✓ All Node.js processes stopped" -ForegroundColor Green
} else {
    Write-Host "✓ No Node.js processes to stop" -ForegroundColor Green
}
Start-Sleep -Seconds 2

# Step 2: Clear Next.js build cache
Write-Host "`n[2/6] Clearing Next.js build cache..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item -Path ".next" -Recurse -Force
    Write-Host "✓ .next directory removed" -ForegroundColor Green
} else {
    Write-Host "✓ .next directory doesn't exist" -ForegroundColor Green
}

# Step 3: Clear Prisma client cache
Write-Host "`n[3/6] Clearing Prisma client cache..." -ForegroundColor Yellow
if (Test-Path "node_modules\.prisma") {
    Remove-Item -Path "node_modules\.prisma" -Recurse -Force
    Write-Host "✓ Prisma cache removed" -ForegroundColor Green
} else {
    Write-Host "✓ Prisma cache doesn't exist" -ForegroundColor Green
}

# Step 4: Regenerate Prisma client
Write-Host "`n[4/6] Regenerating Prisma client..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Prisma client regenerated" -ForegroundColor Green
} else {
    Write-Host "✗ Prisma client regeneration failed" -ForegroundColor Red
    exit 1
}

# Step 5: Sync database
Write-Host "`n[5/6] Syncing database..." -ForegroundColor Yellow
npx prisma db push --skip-generate
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Database synced" -ForegroundColor Green
} else {
    Write-Host "✗ Database sync failed" -ForegroundColor Red
    exit 1
}

# Step 6: Start dev server
Write-Host "`n[6/6] Starting development server..." -ForegroundColor Yellow
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  IMPORTANT NEXT STEPS:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "1. Wait for the dev server to fully start" -ForegroundColor White
Write-Host "2. Open your browser" -ForegroundColor White
Write-Host "3. Visit: http://localhost:3000/api/auth/signout" -ForegroundColor Yellow
Write-Host "4. After signout, clear browser cookies for localhost" -ForegroundColor White
Write-Host "5. Visit: http://localhost:3000/login" -ForegroundColor Yellow
Write-Host "6. Login fresh with your credentials" -ForegroundColor White
Write-Host "========================================`n" -ForegroundColor Cyan

npm run dev
