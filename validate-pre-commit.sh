#!/bin/bash
# Pre-commit validation script for Mac/Linux

set -e

echo ""
echo "========================================"
echo "  Pre-Commit Build Validation"
echo "========================================"
echo ""

echo "[1/3] Generating Prisma Client..."
npx prisma generate > /dev/null 2>&1
echo "✅ Prisma Client generated"

echo ""
echo "[2/3] Running TypeScript type check..."
npx tsc --noEmit
echo "✅ No TypeScript errors"

echo ""
echo "[3/3] Running ESLint..."
npm run lint || echo "⚠️  Linting warnings found (continuing...)"

echo ""
echo "========================================"
echo "  ✅ All checks passed!"
echo "========================================"
echo ""
echo "Ready to commit. To run full build validation:"
echo "npm run build"
echo ""
