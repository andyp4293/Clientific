# Fix Prisma Client and Database Sync Issues
Write-Host "Fixing Prisma Client and Database..." -ForegroundColor Cyan

# Step 0: Stop all Node processes
Write-Host "`n0. Stopping all Node processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "   All Node processes stopped" -ForegroundColor Green

# Step 1: Clear caches
Write-Host "`n1. Clearing caches..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item -Path ".next" -Recurse -Force
    Write-Host "   .next cache cleared" -ForegroundColor Green
}
if (Test-Path "node_modules\.prisma") {
    Remove-Item -Path "node_modules\.prisma" -Recurse -Force
    Write-Host "   Prisma cache cleared" -ForegroundColor Green
}

# Step 2: Regenerate Prisma Client
Write-Host "`n2. Regenerating Prisma Client..." -ForegroundColor Yellow
npx prisma generate --force
if ($LASTEXITCODE -eq 0) {
    Write-Host "   Prisma Client regenerated" -ForegroundColor Green
} else {
    Write-Host "   Failed to regenerate Prisma Client" -ForegroundColor Red
    exit 1
}

# Step 3: Sync Database
Write-Host "`n3. Syncing database schema..." -ForegroundColor Yellow
npx prisma db push
if ($LASTEXITCODE -eq 0) {
    Write-Host "   Database synced" -ForegroundColor Green
} else {
    Write-Host "   Failed to sync database" -ForegroundColor Red
    exit 1
}

Write-Host "`nAll done! Starting dev server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev"
Write-Host "Dev server started in new window" -ForegroundColor Cyan
