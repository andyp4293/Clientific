# Deployment Workflow

This repo uses a fail-fast deployment contract:

1. `npm test`
2. `npx next build`
3. `git push`
4. `npm run deploy:prod`

If any step fails, later steps do not run.

## Default Command

```bash
npm run deploy:prod
```

This runs:

```bash
bash ./scripts/deploy-prod.sh
```

The script runs `npx vercel --prod --yes`, aliases the resulting deployment to
`clientific.app` and `www.clientific.app`, and verifies both domains with
`vercel inspect`. Do not treat a deploy as complete if either custom domain still
points at an older deployment.

## Manual Fallback Commands

```bash
npm test
npx next build
git push
npm run deploy:prod
```

## Post-Deploy Twilio Webhook Wiring

After deploy, point the toll-free SMS webhook at the inbound compliance route:

```bash
twilio phone-numbers:update +18557654989 --sms-url=https://clientific.app/api/webhooks/twilio-sms --sms-method=POST
```

## Data Backfill (One-Time After Schema Update)

Mirror historical transactional SMS consent into the new marketing consent flag:

```bash
npm run db:push
npm run db:generate
npm run db:backfill:sms-marketing
```

## Validation Checklist

1. Send `STOP` from a real handset and verify customer records are marked `smsOptedOut=true` and promotions are suppressed.
2. Send `START` and verify `smsOptedOut=false`, transactional consent resumes, and promotions resume.
3. Trigger "Text My Customers" and verify links open `/d/{dealId}` and claim flow works with required phone input.
