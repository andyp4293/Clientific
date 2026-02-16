# Pre-Deployment Validation Script

This script ensures all code passes validation before committing and deploying.

## Quick Validation Commands

### Before Committing (Fast - No Build)
**Windows PowerShell:**
```powershell
.\validate-pre-commit.ps1
```

**Mac/Linux:**
```bash
./validate-pre-commit.sh
```

**Cross-platform (if type-check script added):**
```bash
npm run type-check
```

**Time: ~10-30 seconds**

### Full Validation (Complete - With Build)
```bash
npm run build
```
**Time: ~2-5 minutes**

## Automated Safeguards

### 1. **Husky Pre-Commit Hook** ✅
- Automatically runs `type-check` before every commit
- Prevents committing code with TypeScript errors
- Setup: Already configured in `.husky/pre-commit`

### 2. **GitHub Actions CI/CD** ✅
- Runs on every push to main/master/develop
- Validates: type-check → lint → build
- See: `.github/workflows/build.yml`

### 3. **npm Scripts** ✅
Added to `package.json`:
- `npm run type-check` - TypeScript validation only (fast)
- `npm run validate` - Complete validation (type-check + lint + build)

## Recommended Workflow

### Quick Pre-Commit Check (Windows)
```powershell
# 1. Make your changes
# 2. Run validation script
.\validate-pre-commit.ps1

# 3. If passed, commit and push
git add .
git commit -m "fix: your message"
git push
```

### Quick Pre-Commit Check (Mac/Linux)
```bash
# 1. Make your changes
# 2. Run validation script
./validate-pre-commit.sh

# 3. If passed, commit and push
git add .
git commit -m "fix: your message"
git push
```

### Full Local Build (For Major Changes)
```bash
# 1. Make your changes
# 2. Full build test
npm run build

# 3. If successful, commit and push
git add .
git commit -m "feat: your message"
git push
```

## Setup Instructions

### Install Husky (One-Time Setup)
```bash
npm install --save-dev husky
npm run prepare
chmod +x .husky/pre-commit  # Mac/Linux only
```

### Test the Hook
```bash
# Try to commit - it should run type-check automatically
git add .
git commit -m "test: validate pre-commit hook"
```

## Troubleshooting

### Pre-commit hook not running?
```bash
# Reinstall Husky
rm -rf .husky
npm run prepare
chmod +x .husky/pre-commit  # Mac/Linux only
```

### Want to bypass the hook (emergency only)?
```bash
git commit --no-verify -m "emergency fix"
```

### Check build errors locally before pushing:
```bash
npm run build
```

## What Each Validation Catches

| Check | What It Finds | Speed |
|-------|--------------|-------|
| `type-check` | TypeScript errors, type mismatches | ⚡ Fast (10-30s) |
| `lint` | Code quality, unused vars, formatting | ⚡ Fast (5-15s) |
| `build` | Runtime errors, import issues, full compilation | 🐌 Slow (2-5m) |

## Current Build Protection

✅ **Pre-commit hook** prevents TypeScript errors from being committed
✅ **GitHub Actions** catches build failures before Vercel deployment
✅ **npm scripts** provide manual validation options
⚠️ **Vercel** will still attempt to build, but failures happen early with CI/CD

## Best Practice

**For maximum safety before deploying:**

```bash
# Full local build test
npm run validate

# If successful, deploy
git push
```

This catches 99% of build issues before they reach Vercel.
