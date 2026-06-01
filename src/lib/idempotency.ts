import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const IDEMPOTENCY_HEADERS = ['idempotency-key', 'x-idempotency-key'];
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOCK_MS = 2 * 60 * 1000;

type IdempotencyRecordDelegate = {
  create: (args: unknown) => Promise<IdempotencyRecord>;
  findUnique: (args: unknown) => Promise<IdempotencyRecord | null>;
  update: (args: unknown) => Promise<IdempotencyRecord>;
};

type IdempotencyRecord = {
  key: string;
  requestHash: string;
  status: string;
  responseStatus: number | null;
  responseBody: unknown | null;
  lockedUntil: Date;
  expiresAt: Date;
};

type IdempotentJsonResult = {
  body: Record<string, unknown>;
  status?: number;
};

type RunIdempotentJsonOptions = {
  scope: string;
  ownerId?: string | null;
  key: string;
  requestHash: string;
  ttlMs?: number;
  lockMs?: number;
  handler: (context: { idempotencyKey: string }) => Promise<IdempotentJsonResult>;
};

function getIdempotencyDelegate(): IdempotencyRecordDelegate | null {
  const delegate = (prisma as unknown as { idempotencyRecord?: IdempotencyRecordDelegate })
    .idempotencyRecord;

  if (!delegate && process.env.NODE_ENV !== 'test') {
    throw new Error('IdempotencyRecord Prisma delegate is not available. Run prisma generate and apply the schema.');
  }

  return delegate ?? null;
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function stableSerialize(value: unknown): string {
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    return `{${Object.keys(objectValue)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(objectValue[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function toJsonSafeBody(body: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(body)) as Record<string, unknown>;
}

function isUniqueConstraintError(error: unknown) {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') ||
    (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002')
  );
}

function responseWithHeaders(
  body: Record<string, unknown>,
  status: number,
  idempotencyKey: string,
  replayed = false
) {
  const response = NextResponse.json(body, { status });
  response.headers.set('x-idempotency-key', idempotencyKey);
  if (replayed) {
    response.headers.set('x-idempotency-replayed', 'true');
  }
  return response;
}

export function getRequestIdempotencyKey(req: Request) {
  for (const header of IDEMPOTENCY_HEADERS) {
    const value = req.headers.get(header)?.trim();
    if (value) {
      return value.slice(0, 500);
    }
  }

  return null;
}

export function buildIdempotencyFingerprint(parts: unknown[]) {
  return hash(stableSerialize(parts));
}

export function buildAutomaticIdempotencyKey(scope: string, parts: unknown[]) {
  return `${scope}:${buildIdempotencyFingerprint(parts)}`;
}

export function buildScopedIdempotencyKey({
  scope,
  ownerId,
  key,
}: {
  scope: string;
  ownerId?: string | null;
  key: string;
}) {
  return `${scope}:${ownerId || 'global'}:${hash(key)}`;
}

export async function runIdempotentJson({
  scope,
  ownerId,
  key,
  requestHash,
  ttlMs = DEFAULT_TTL_MS,
  lockMs = DEFAULT_LOCK_MS,
  handler,
}: RunIdempotentJsonOptions) {
  const delegate = getIdempotencyDelegate();

  if (!delegate) {
    const result = await handler({
      idempotencyKey: buildScopedIdempotencyKey({ scope, ownerId, key }),
    });
    return NextResponse.json(result.body, { status: result.status ?? 200 });
  }

  const scopedKey = buildScopedIdempotencyKey({ scope, ownerId, key });
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + lockMs);
  const expiresAt = new Date(now.getTime() + ttlMs);
  let acquired = false;

  try {
    await delegate.create({
      data: {
        key: scopedKey,
        scope,
        requestHash,
        status: 'processing',
        lockedUntil,
        expiresAt,
      },
    });
    acquired = true;
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const existing = await delegate.findUnique({ where: { key: scopedKey } });
    if (!existing) {
      throw error;
    }

    if (existing.expiresAt.getTime() <= now.getTime()) {
      await delegate.update({
        where: { key: scopedKey },
        data: {
          requestHash,
          status: 'processing',
          responseStatus: null,
          responseBody: null,
          lockedUntil,
          expiresAt,
        },
      });
      acquired = true;
    } else if (existing.requestHash !== requestHash) {
      return responseWithHeaders(
        {
          error: 'Idempotency key was already used with a different request payload.',
        },
        409,
        scopedKey
      );
    } else if (existing.status === 'completed' && existing.responseStatus && existing.responseBody) {
      return responseWithHeaders(
        existing.responseBody as Record<string, unknown>,
        existing.responseStatus,
        scopedKey,
        true
      );
    } else if (
      existing.status === 'processing' &&
      existing.lockedUntil.getTime() > now.getTime()
    ) {
      return responseWithHeaders(
        { error: 'This request is already being processed. Please retry shortly.' },
        409,
        scopedKey
      );
    } else {
      await delegate.update({
        where: { key: scopedKey },
        data: {
          status: 'processing',
          responseStatus: null,
          responseBody: null,
          lockedUntil,
          expiresAt,
        },
      });
      acquired = true;
    }
  }

  try {
    const result = await handler({ idempotencyKey: scopedKey });
    const status = result.status ?? 200;

    if (status >= 200 && status < 300) {
      await delegate.update({
        where: { key: scopedKey },
        data: {
          status: 'completed',
          responseStatus: status,
          responseBody: toJsonSafeBody(result.body),
          lockedUntil: now,
          expiresAt,
        },
      });
    } else if (acquired) {
      await delegate.update({
        where: { key: scopedKey },
        data: {
          status: 'failed',
          responseStatus: null,
          responseBody: null,
          lockedUntil: now,
          expiresAt,
        },
      });
    }

    return responseWithHeaders(result.body, status, scopedKey);
  } catch (error) {
    if (acquired) {
      await delegate.update({
        where: { key: scopedKey },
        data: {
          status: 'failed',
          lockedUntil: now,
          expiresAt,
        },
      });
    }
    throw error;
  }
}
