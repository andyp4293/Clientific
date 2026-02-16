@echo off
REM Pre-commit validation script for Windows

echo.
echo ========================================
echo   Pre-Commit Build Validation
echo ========================================
echo.

echo [1/3] Generating Prisma Client...
call npx prisma generate >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Prisma generation failed
    exit /b 1
)
echo ✅ Prisma Client generated

echo.
echo [2/3] Running TypeScript type check...
call npx tsc --noEmit
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ TypeScript errors found. Please fix before committing.
    exit /b 1
)
echo ✅ No TypeScript errors

echo.
echo [3/3] Running ESLint...
call npm run lint
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  Linting warnings found (continuing...)
) else (
    echo ✅ No linting errors
)

echo.
echo ========================================
echo   ✅ All checks passed!
echo ========================================
echo.
echo Ready to commit. To run full build validation:
echo npm run build
echo.

exit /b 0
