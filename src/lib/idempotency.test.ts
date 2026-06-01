import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.hoisted(() => vi.fn());
const mockFindUnique = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  prisma: {
    idempotencyRecord: {
      create: mockCreate,
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));

import {
  buildIdempotencyFingerprint,
  buildScopedIdempotencyKey,
  runIdempotentJson,
} from './idempotency';

type TestRecord = {
  key: string;
  scope: string;
  requestHash: string;
  status: string;
  responseStatus: number | null;
  responseBody: Record<string, unknown> | null;
  lockedUntil: Date;
  expiresAt: Date;
};

const records = new Map<string, TestRecord>();

beforeEach(() => {
  records.clear();
  vi.clearAllMocks();

  mockCreate.mockImplementation(async ({ data }: { data: TestRecord }) => {
    if (records.has(data.key)) {
      throw { code: 'P2002' };
    }

    const record = {
      ...data,
      responseStatus: data.responseStatus ?? null,
      responseBody: data.responseBody ?? null,
    };
    records.set(record.key, record);
    return record;
  });

  mockFindUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
    return records.get(where.key) ?? null;
  });

  mockUpdate.mockImplementation(
    async ({ where, data }: { where: { key: string }; data: Partial<TestRecord> }) => {
      const existing = records.get(where.key);
      if (!existing) {
        throw new Error(`Missing idempotency record ${where.key}`);
      }
      const updated = { ...existing, ...data };
      records.set(where.key, updated);
      return updated;
    }
  );
});

describe('runIdempotentJson', () => {
  it('stores a successful response and replays duplicate requests without rerunning the handler', async () => {
    const requestHash = buildIdempotencyFingerprint(['checkout', 'biz-1', 'starter']);
    const handler = vi.fn(async () => ({ body: { url: 'https://checkout.test/session' } }));

    const first = await runIdempotentJson({
      scope: 'subscription-checkout',
      ownerId: 'biz-1',
      key: 'same-click',
      requestHash,
      handler,
    });
    const second = await runIdempotentJson({
      scope: 'subscription-checkout',
      ownerId: 'biz-1',
      key: 'same-click',
      requestHash,
      handler,
    });

    await expect(first.json()).resolves.toEqual({ url: 'https://checkout.test/session' });
    await expect(second.json()).resolves.toEqual({ url: 'https://checkout.test/session' });
    expect(second.headers.get('x-idempotency-replayed')).toBe('true');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('rejects key reuse when the payload fingerprint changes', async () => {
    const handler = vi.fn(async () => ({ body: { ok: true } }));

    await runIdempotentJson({
      scope: 'public-booking',
      ownerId: 'biz-1',
      key: 'customer-submit',
      requestHash: buildIdempotencyFingerprint(['booking', '9am']),
      handler,
    });
    const replay = await runIdempotentJson({
      scope: 'public-booking',
      ownerId: 'biz-1',
      key: 'customer-submit',
      requestHash: buildIdempotencyFingerprint(['booking', '10am']),
      handler,
    });

    expect(replay.status).toBe(409);
    await expect(replay.json()).resolves.toEqual({
      error: 'Idempotency key was already used with a different request payload.',
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('blocks duplicate requests while the original request is still processing', async () => {
    const requestHash = buildIdempotencyFingerprint(['deal-checkout', 'deal-1']);
    const scopedKey = buildScopedIdempotencyKey({
      scope: 'deal-checkout',
      ownerId: 'biz-1',
      key: 'double-tap',
    });
    records.set(scopedKey, {
      key: scopedKey,
      scope: 'deal-checkout',
      requestHash,
      status: 'processing',
      responseStatus: null,
      responseBody: null,
      lockedUntil: new Date(Date.now() + 60_000),
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    const response = await runIdempotentJson({
      scope: 'deal-checkout',
      ownerId: 'biz-1',
      key: 'double-tap',
      requestHash,
      handler: vi.fn(async () => ({ body: { ok: true } })),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'This request is already being processed. Please retry shortly.',
    });
  });
});
