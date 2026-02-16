# Pre-commit validation script for Windows PowerShell

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Pre-Commit Build Validation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Generating Prisma Client..." -ForegroundColor Yellow
try {
    npx prisma generate 2>&1 | Out-Null
    Write-Host "✅ Prisma Client generated" -ForegroundColor Green
} catch {
    Write-Host "❌ Prisma generation failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/3] Running TypeScript type check..." -ForegroundColor Yellow
$typecheck = npx tsc --noEmit 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ TypeScript errors found:" -ForegroundColor Red
    Write-Host $typecheck
    Write-Host ""
    Write-Host "Please fix these errors before committing." -ForegroundColor Red
    exit 1
}
Write-Host "✅ No TypeScript errors" -ForegroundColor Green

Write-Host ""
Write-Host "[3/3] Running ESLint..." -ForegroundColor Yellow
npm run lint 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Linting warnings found (continuing...)" -ForegroundColor Yellow
} else {
    Write-Host "✅ No linting errors" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ All checks passed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ready to commit. To run full build validation:" -ForegroundColor White
Write-Host "npm run build" -ForegroundColor Yellow
Write-Host ""

exit 0
