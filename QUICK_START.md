# ⚡ QUICK START - 30 Second Reference

## Before Every Commit:

```powershell
.\validate-pre-commit.ps1
```

**If it fails:** Fix the errors and run again
**If it passes:** You're safe to commit

---

## The 3-Step Deploy:

```powershell
# 1. Validate
.\validate-pre-commit.ps1

# 2. Commit
git add .
git commit -m "your message"

# 3. Deploy
git push
```

---

## For Major Changes:

```bash
npm run build
```

---

## Emergency Bypass (DON'T USE):

```bash
git commit --no-verify
```

---

## That's It!

**Read More:** `BUILD_SUCCESS_WORKFLOW.md`
