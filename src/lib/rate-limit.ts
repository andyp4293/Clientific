export type HeaderReader = {
  get(name: string): string | null;
};

export type RateLimitRequest = {
  pathname: string;
  method: string;
  headers: HeaderReader;
  now?: number;
};

export type RateLimitPolicy = {
  id: string;
  limit: number;
  windowMs: number;
  message: string;
  match: (request: RateLimitRequest) => boolean;
};

export type RateLimitCheck = {
  policyId: string;
  key: string;
  limit: number;
  windowMs: number;
  message: string;
};

type WindowState = {
  count: number;
  resetAt: number;
  touchedAt: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  policyId?: string;
  limit?: number;
  remaining?: number;
  resetAt?: number;
  retryAfterSeconds?: number;
  message?: string;
  headers: Record<string, string>;
};

const WINDOW = {
  minute: 60 * 1000,
  tenMinutes: 10 * 60 * 1000,
  hour: 60 * 60 * 1000,
};

const MAX_STORED_WINDOWS = 20_000;
const TARGET_STORED_WINDOWS_AFTER_PRUNE = 16_000;

const PUBLIC_WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PREFLIGHT_METHODS = new Set(['OPTIONS']);

const rateLimitStore = new Map<string, WindowState>();

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname.startsWith(prefix));
}

function matchesAny(pathname: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(pathname));
}

function normalizeMethod(method: string) {
  return method.toUpperCase();
}

function isPublicWrite(request: RateLimitRequest) {
  const method = normalizeMethod(request.method);
  return (
    PUBLIC_WRITE_METHODS.has(method) &&
    (startsWithAny(request.pathname, [
      '/api/public/business/',
      '/api/public/business-by-id/',
      '/api/public/deals/',
      '/api/deals/lookup',
      '/api/deals/redeem',
      '/api/deal-purchases/redeem',
      '/api/checkins',
      '/api/capture',
    ]) ||
      matchesAny(request.pathname, [
        /^\/api\/public\/appointment(?:\/|$)/,
        /^\/api\/public\/appointment-batch(?:\/|$)/,
        /^\/api\/public\/review-survey(?:\/|$)/,
      ]))
  );
}

function isPaymentOrPayoutRequest(request: RateLimitRequest) {
  return startsWithAny(request.pathname, [
    '/api/checkout/',
    '/api/billing/',
    '/api/mobile/billing/',
    '/api/stripe/connect/',
    '/api/public/deals/',
    '/api/deal-purchases/',
    '/api/mobile/funds',
    '/api/deal-purchases/earnings',
  ]);
}

function isMessagingRequest(request: RateLimitRequest) {
  return (
    startsWithAny(request.pathname, [
      '/api/reviews/request',
      '/api/mobile/reviews/request',
      '/api/deals/',
      '/api/mobile/customers/',
      '/api/customers/',
    ]) &&
    (request.pathname.includes('/message') ||
      request.pathname.includes('/notify') ||
      request.pathname.includes('/reviews/request'))
  );
}

function isAuthMutation(request: RateLimitRequest) {
  const method = normalizeMethod(request.method);
  return (
    MUTATING_METHODS.has(method) &&
    (startsWithAny(request.pathname, ['/api/auth/', '/api/mobile/auth/']) ||
      request.pathname === '/login' ||
      request.pathname === '/signup')
  );
}

function isMobileApi(pathname: string) {
  return pathname.startsWith('/api/mobile/');
}

function isApi(pathname: string) {
  return pathname.startsWith('/api/');
}

function isDynamicPublicPage(pathname: string) {
  return startsWithAny(pathname, ['/book/', '/appt/', '/deal/', '/capture/']);
}

function isBypassedPath(pathname: string) {
  return startsWithAny(pathname, [
    '/api/internal/rate-limit',
    '/api/webhooks/',
    '/api/cron/',
    '/api/auth/session',
    '/api/auth/csrf',
  ]);
}

export const rateLimitPolicies: RateLimitPolicy[] = [
  {
    id: 'auth-burst',
    limit: 8,
    windowMs: WINDOW.minute,
    message: 'Too many sign-in or account attempts. Please wait a minute and try again.',
    match: isAuthMutation,
  },
  {
    id: 'auth-sustained',
    limit: 40,
    windowMs: WINDOW.tenMinutes,
    message: 'Too many account attempts from this network. Please wait before trying again.',
    match: isAuthMutation,
  },
  {
    id: 'payment-sensitive',
    limit: 45,
    windowMs: WINDOW.minute,
    message: 'Too many billing or payment requests. Please wait a moment and try again.',
    match: isPaymentOrPayoutRequest,
  },
  {
    id: 'public-write',
    limit: 35,
    windowMs: WINDOW.minute,
    message: 'Too many booking or signup attempts. Please wait a moment and try again.',
    match: isPublicWrite,
  },
  {
    id: 'messaging-sensitive',
    limit: 30,
    windowMs: WINDOW.tenMinutes,
    message: 'Too many messaging requests. Please wait before sending more.',
    match: isMessagingRequest,
  },
  {
    id: 'mobile-api',
    limit: 240,
    windowMs: WINDOW.minute,
    message: 'Too many mobile app requests. Please wait a moment and try again.',
    match: (request) => isMobileApi(request.pathname),
  },
  {
    id: 'api-global-burst',
    limit: 180,
    windowMs: WINDOW.minute,
    message: 'Too many requests. Please wait a moment and try again.',
    match: (request) => isApi(request.pathname),
  },
  {
    id: 'api-global-sustained',
    limit: 1_800,
    windowMs: WINDOW.hour,
    message: 'Too many requests from this network. Please wait before trying again.',
    match: (request) => isApi(request.pathname),
  },
  {
    id: 'public-page-burst',
    limit: 120,
    windowMs: WINDOW.minute,
    message: 'Too many page requests. Please wait a moment and try again.',
    match: (request) => isDynamicPublicPage(request.pathname),
  },
];

function parseTrustedIps() {
  return (process.env.RATE_LIMIT_TRUSTED_IPS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function firstForwardedIp(value: string | null) {
  if (!value) return null;
  return value.split(',')[0]?.trim() || null;
}

export function getClientIp(headers: HeaderReader) {
  return (
    firstForwardedIp(headers.get('true-client-ip')) ||
    firstForwardedIp(headers.get('cf-connecting-ip')) ||
    firstForwardedIp(headers.get('x-real-ip')) ||
    firstForwardedIp(headers.get('x-vercel-forwarded-for')) ||
    firstForwardedIp(headers.get('x-forwarded-for')) ||
    'unknown'
  );
}

function getUserAgentBucket(headers: HeaderReader) {
  const userAgent = headers.get('user-agent') || 'unknown';
  return userAgent.slice(0, 120).toLowerCase();
}

function getRateLimitKey(policy: RateLimitPolicy, request: RateLimitRequest, clientIp: string) {
  const method = normalizeMethod(request.method);
  const ua = getUserAgentBucket(request.headers);

  if (policy.id.startsWith('api-global') || policy.id === 'mobile-api') {
    return `${policy.id}:${clientIp}`;
  }

  if (policy.id === 'public-page-burst') {
    return `${policy.id}:${clientIp}:${ua}`;
  }

  return `${policy.id}:${clientIp}:${method}:${request.pathname}`;
}

function pruneStore(now: number) {
  if (rateLimitStore.size <= MAX_STORED_WINDOWS) return;

  for (const [key, state] of rateLimitStore.entries()) {
    if (state.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }

  if (rateLimitStore.size <= TARGET_STORED_WINDOWS_AFTER_PRUNE) return;

  const oldest = [...rateLimitStore.entries()]
    .sort((a, b) => a[1].touchedAt - b[1].touchedAt)
    .slice(0, rateLimitStore.size - TARGET_STORED_WINDOWS_AFTER_PRUNE);

  for (const [key] of oldest) {
    rateLimitStore.delete(key);
  }
}

function buildHeaders(limit: number, remaining: number, resetAt: number, retryAfterSeconds = 0) {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(Math.max(0, remaining)),
    'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
  };

  if (retryAfterSeconds > 0) {
    headers['Retry-After'] = String(retryAfterSeconds);
  }

  return headers;
}

export function getRateLimitChecks(request: RateLimitRequest): RateLimitCheck[] {
  const method = normalizeMethod(request.method);
  const clientIp = getClientIp(request.headers);

  if (
    process.env.RATE_LIMIT_DISABLED === 'true' ||
    PREFLIGHT_METHODS.has(method) ||
    isBypassedPath(request.pathname) ||
    parseTrustedIps().includes(clientIp)
  ) {
    return [];
  }

  return rateLimitPolicies
    .filter((policy) => policy.match(request))
    .map((policy) => ({
      policyId: policy.id,
      key: getRateLimitKey(policy, request, clientIp),
      limit: policy.limit,
      windowMs: policy.windowMs,
      message: policy.message,
    }));
}

export function buildRateLimitDecisionFromCount(
  check: RateLimitCheck,
  count: number,
  resetAt: number,
  now: number,
): RateLimitDecision {
  const remaining = check.limit - count;

  if (remaining < 0) {
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
    return {
      allowed: false,
      policyId: check.policyId,
      limit: check.limit,
      remaining: 0,
      resetAt,
      retryAfterSeconds,
      message: check.message,
      headers: buildHeaders(check.limit, 0, resetAt, retryAfterSeconds),
    };
  }

  return {
    allowed: true,
    policyId: check.policyId,
    limit: check.limit,
    remaining,
    resetAt,
    headers: buildHeaders(check.limit, remaining, resetAt),
  };
}

export function checkRateLimit(request: RateLimitRequest): RateLimitDecision {
  const now = request.now ?? Date.now();
  const checks = getRateLimitChecks(request);
  if (checks.length === 0) {
    return { allowed: true, headers: {} };
  }

  pruneStore(now);

  let mostRestrictiveAllowed: RateLimitDecision | null = null;

  for (const check of checks) {
    const existing = rateLimitStore.get(check.key);
    const windowState =
      existing && existing.resetAt > now
        ? existing
        : { count: 0, resetAt: now + check.windowMs, touchedAt: now };

    windowState.count += 1;
    windowState.touchedAt = now;
    rateLimitStore.set(check.key, windowState);

    const decision = buildRateLimitDecisionFromCount(
      check,
      windowState.count,
      windowState.resetAt,
      now,
    );

    if (!decision.allowed) {
      return decision;
    }

    if (
      !mostRestrictiveAllowed ||
      (decision.remaining ?? Infinity) < (mostRestrictiveAllowed.remaining ?? Infinity)
    ) {
      mostRestrictiveAllowed = decision;
    }
  }

  return mostRestrictiveAllowed ?? { allowed: true, headers: {} };
}

export function resetRateLimitStore() {
  rateLimitStore.clear();
}
