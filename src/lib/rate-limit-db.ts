import { prisma } from '@/lib/prisma';
import {
  buildRateLimitDecisionFromCount,
  getRateLimitChecks,
  type HeaderReader,
  type RateLimitDecision,
  type RateLimitRequest,
} from '@/lib/rate-limit';

type RateLimitWindowRow = {
  count: number;
  resetAt: Date;
};

const INSERT_RATE_LIMIT_WINDOW_SQL = `
  INSERT INTO "RateLimitWindow" ("key", "count", "resetAt", "touchedAt", "createdAt")
  VALUES ($1, 1, $2, $3, $3)
  ON CONFLICT ("key") DO UPDATE SET
    "count" = CASE
      WHEN "RateLimitWindow"."resetAt" <= $3 THEN 1
      ELSE "RateLimitWindow"."count" + 1
    END,
    "resetAt" = CASE
      WHEN "RateLimitWindow"."resetAt" <= $3 THEN $2
      ELSE "RateLimitWindow"."resetAt"
    END,
    "touchedAt" = $3
  RETURNING "count", "resetAt"
`;

export async function checkDatabaseRateLimit(
  request: RateLimitRequest,
): Promise<RateLimitDecision> {
  const now = request.now ?? Date.now();
  const checks = getRateLimitChecks(request);

  if (checks.length === 0) {
    return { allowed: true, headers: {} };
  }

  let mostRestrictiveAllowed: RateLimitDecision | null = null;

  for (const check of checks) {
    const resetAt = new Date(now + check.windowMs);
    const currentTime = new Date(now);
    const rows = await prisma.$queryRawUnsafe<RateLimitWindowRow[]>(
      INSERT_RATE_LIMIT_WINDOW_SQL,
      check.key,
      resetAt,
      currentTime,
    );
    const row = rows[0];

    if (!row) {
      throw new Error(`Rate limit window was not returned for ${check.policyId}`);
    }

    const decision = buildRateLimitDecisionFromCount(
      check,
      row.count,
      row.resetAt.getTime(),
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

export function headersFromRateLimitPayload(payload: {
  ip?: unknown;
  userAgent?: unknown;
}): HeaderReader {
  const values = new Map<string, string>();

  if (typeof payload.ip === 'string' && payload.ip.trim()) {
    values.set('x-forwarded-for', payload.ip.trim());
  }

  if (typeof payload.userAgent === 'string' && payload.userAgent.trim()) {
    values.set('user-agent', payload.userAgent.slice(0, 500));
  }

  return {
    get(name: string) {
      return values.get(name.toLowerCase()) ?? null;
    },
  };
}
