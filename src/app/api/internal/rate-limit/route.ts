import { NextResponse } from 'next/server';
import { checkDatabaseRateLimit, headersFromRateLimitPayload } from '@/lib/rate-limit-db';

export const dynamic = 'force-dynamic';

function getInternalSecret() {
  return process.env.RATE_LIMIT_INTERNAL_SECRET || process.env.NEXTAUTH_SECRET;
}

function isSafePathname(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    value.length <= 512 &&
    !value.includes('://')
  );
}

function isSafeMethod(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]{3,7}$/i.test(value);
}

export async function POST(request: Request) {
  const secret = getInternalSecret();

  let body: {
    pathname?: unknown;
    method?: unknown;
    ip?: unknown;
    userAgent?: unknown;
    internalSecret?: unknown;
  } = {};
  let bodyParseFailed = false;

  try {
    body = await request.json();
  } catch {
    bodyParseFailed = true;
  }

  const headerSecret = request.headers.get('x-clientific-internal-rate-limit');
  const bodySecret = typeof body.internalSecret === 'string' ? body.internalSecret : null;

  if (!secret || (headerSecret !== secret && bodySecret !== secret)) {
    if (headerSecret || bodySecret) {
      console.warn('[rate-limit] Rejected internal limiter request', {
        hasSecret: Boolean(secret),
        headerPresent: Boolean(headerSecret),
        bodySecretPresent: Boolean(bodySecret),
        secretLength: secret?.length ?? 0,
        headerLength: headerSecret?.length ?? 0,
        bodySecretLength: bodySecret?.length ?? 0,
      });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (bodyParseFailed) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!isSafePathname(body.pathname) || !isSafeMethod(body.method)) {
    return NextResponse.json({ error: 'Invalid rate limit request' }, { status: 400 });
  }

  try {
    const decision = await checkDatabaseRateLimit({
      pathname: body.pathname,
      method: body.method,
      headers: headersFromRateLimitPayload(body),
    });

    return NextResponse.json(decision, { headers: decision.headers });
  } catch (error) {
    console.error('[rate-limit] Persistent limiter failed:', error);
    return NextResponse.json(
      { error: 'Rate limit unavailable', code: 'RATE_LIMIT_UNAVAILABLE' },
      { status: 503 },
    );
  }
}
