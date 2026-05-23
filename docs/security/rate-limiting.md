# Clientific Rate Limiting

Clientific uses two layers of abuse protection:

1. Vercel's platform DDoS mitigation, which is always active in front of the deployment.
2. Application-level request throttling in `src/proxy.ts`, before API route handlers run.
3. A shared `RateLimitWindow` database table, so limits keep working when Vercel spreads traffic
   across multiple production isolates.

The app-level limiter is intentionally route-aware:

- Auth mutations: 8 requests per minute and 40 requests per 10 minutes per IP/path.
- Payment, billing, payout, and deal-purchase APIs: 45 requests per minute.
- Public booking, check-in, capture, review, and deal write APIs: 35 requests per minute.
- SMS/review/deal notification actions: 30 requests per 10 minutes.
- Mobile API traffic: 240 requests per minute.
- General API burst traffic: 180 requests per minute and 1,800 requests per hour.
- Public dynamic booking/deal/capture pages: 120 requests per minute.

Provider webhooks and Vercel cron routes are bypassed at the app limiter because they are already
authenticated by signatures/secrets and can legitimately retry in bursts. Keep signature validation
strict in those route handlers.

Optional environment controls:

- `RATE_LIMIT_DISABLED=true` disables app-level throttling only for emergency debugging.
- `RATE_LIMIT_TRUSTED_IPS=203.0.113.10,198.51.100.8` bypasses known monitors or internal admin IPs.
- `RATE_LIMIT_PERSISTENT_DISABLED=true` disables the shared database limiter and keeps only the
  in-process safety net. This should only be used during an incident where the database limiter is
  unhealthy.
- `RATE_LIMIT_INTERNAL_SECRET` optionally sets the shared secret used by the proxy when calling the
  internal database limiter. If omitted, `NEXTAUTH_SECRET` is used.

For Enterprise/Pro hardening in Vercel Firewall, mirror the same buckets at the edge dashboard/API,
especially:

- `/api/auth/` and `/api/mobile/auth/`: challenge or deny after 8-10 POST requests per minute per IP.
- `/api/public/*/book`, `/api/public/deals/*`, `/api/checkins*`: deny after roughly 30-40 write requests per minute per IP.
- `/api/checkout/*`, `/api/billing/*`, `/api/stripe/connect/*`, `/api/deal-purchases/*`: deny after roughly 40-50 requests per minute per IP.
- `/api/*`: deny after roughly 150-200 requests per minute per IP.

Do not add a blanket low limit to `/api/webhooks/*` unless the provider IP ranges/signatures are
explicitly allowlisted first.
