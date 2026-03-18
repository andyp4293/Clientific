import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
vi.mock('@/lib/subscription', () => ({ requireActiveSubscription: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    deal: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription';
import { PATCH } from './route';

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockRequireActiveSubscription = requireActiveSubscription as ReturnType<typeof vi.fn>;
const mockDealFindUnique = prisma.deal.findUnique as ReturnType<typeof vi.fn>;
const mockDealUpdate = prisma.deal.update as ReturnType<typeof vi.fn>;

const activeSession = { user: { id: 'biz-1' } };
const existingDeal = {
  id: 'deal-1',
  businessId: 'biz-1',
  startsAt: new Date('2026-03-11T00:00:00.000Z'),
  expiresAt: new Date('2026-03-31T23:59:59.999Z'),
};

function makePatchRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/deals/deal-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-10T15:00:00.000Z'));
  mockSession.mockResolvedValue(activeSession);
  mockRequireActiveSubscription.mockResolvedValue(null);
  mockDealFindUnique.mockResolvedValue(existingDeal);
});

afterAll(() => {
  vi.useRealTimers();
});

describe('PATCH /api/deals/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({ title: 'New title' }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 400 when date input is invalid', async () => {
    const res = await PATCH(
      makePatchRequest({ startsAt: 'not-a-date' }),
      { params: Promise.resolve({ id: 'deal-1' }) }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid deal dates/i);
    expect(mockDealUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 when start date is earlier than today', async () => {
    const res = await PATCH(
      makePatchRequest({ startsAt: '2026-03-09' }),
      { params: Promise.resolve({ id: 'deal-1' }) }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/start date cannot be earlier than today/i);
    expect(mockDealUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 when end date is the same day as start date', async () => {
    const res = await PATCH(
      makePatchRequest({ startsAt: '2026-03-12', expiresAt: '2026-03-12' }),
      { params: Promise.resolve({ id: 'deal-1' }) }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/end date must be at least one day after start date/i);
    expect(mockDealUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 when patching percent_off > 100', async () => {
    const res = await PATCH(
      makePatchRequest({ discountType: 'percent_off', discountValue: 150 }),
      { params: Promise.resolve({ id: 'deal-1' }) }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/between 1% and 100%/i);
    expect(mockDealUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 when patching percent_off to 0', async () => {
    const res = await PATCH(
      makePatchRequest({ discountType: 'percent_off', discountValue: 0 }),
      { params: Promise.resolve({ id: 'deal-1' }) }
    );
    expect(res.status).toBe(400);
    expect(mockDealUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 when patching amount_off to negative value', async () => {
    const res = await PATCH(
      makePatchRequest({ discountType: 'amount_off', discountValue: -10 }),
      { params: Promise.resolve({ id: 'deal-1' }) }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/greater than \$0/i);
    expect(mockDealUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 when patching amount_off to 0', async () => {
    const res = await PATCH(
      makePatchRequest({ discountType: 'amount_off', discountValue: 0 }),
      { params: Promise.resolve({ id: 'deal-1' }) }
    );
    expect(res.status).toBe(400);
    expect(mockDealUpdate).not.toHaveBeenCalled();
  });

  it('validates discountValue against existing discountType when type is not in patch body', async () => {
    // existing deal has discountType, patch only sends discountValue
    mockDealFindUnique.mockResolvedValue({ ...existingDeal, discountType: 'percent_off' });
    const res = await PATCH(
      makePatchRequest({ discountValue: 110 }), // no discountType in body — uses existing 'percent_off'
      { params: Promise.resolve({ id: 'deal-1' }) }
    );
    expect(res.status).toBe(400);
    expect(mockDealUpdate).not.toHaveBeenCalled();
  });

  it('normalizes date-only inputs to full-day bounds', async () => {
    mockDealUpdate.mockResolvedValue({ ...existingDeal, id: 'deal-1' });

    const res = await PATCH(
      makePatchRequest({ startsAt: '2026-03-10', expiresAt: '2026-03-11' }),
      { params: Promise.resolve({ id: 'deal-1' }) }
    );

    expect(res.status).toBe(200);

    const updateArgs = mockDealUpdate.mock.calls[0][0] as any;
    const startsAt = updateArgs.data.startsAt as Date;
    const expiresAt = updateArgs.data.expiresAt as Date;

    expect(startsAt.getHours()).toBe(0);
    expect(startsAt.getMinutes()).toBe(0);
    expect(expiresAt.getHours()).toBe(23);
    expect(expiresAt.getMinutes()).toBe(59);
  });
});
