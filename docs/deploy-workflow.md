# Deployment Workflow

This repo uses a fail-fast deployment contract:

1. `npm test`
2. `npx next build`
3. `git push`
4. `npx vercel --prod`

If any step fails, later steps do not run.

## Default Command

```powershell
npm run deploy:prod
```

This runs:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/deploy-prod.ps1
```

## Manual Fallback Commands

```powershell
cmd /c npm test
cmd /c npx next build
git push
cmd /c npx vercel --prod
```

## Post-Deploy Twilio Webhook Wiring

After deploy, point the toll-free SMS webhook at the inbound compliance route:

```powershell
twilio phone-numbers:update +18557654989 --sms-url=https://clientific.app/api/webhooks/twilio-sms --sms-method=POST
```

## Data Backfill (One-Time After Schema Update)

Mirror historical transactional SMS consent into the new marketing consent flag:

```powershell
npm run db:push
npm run db:generate
npm run db:backfill:sms-marketing
```

## Script Options

For safe local verification without mutating remote state:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/deploy-prod.ps1 -SkipPush -SkipDeploy
```

To intentionally verify fail-fast behavior at the test step:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/deploy-prod.ps1 -TestCommand "npm run does-not-exist" -SkipPush -SkipDeploy
```

## Validation Checklist

1. Send `STOP` from a real handset and verify customer records are marked `smsOptedOut=true` and promotions are suppressed.
2. Send `START` and verify `smsOptedOut=false`, transactional consent resumes, and promotions resume.
3. Trigger "Text My Customers" and verify links open `/d/{dealId}` and claim flow works with required phone input.
