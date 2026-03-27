import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findFirst: vi.fn(),
    },
    business: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/direct-message-quota', () => ({
  reserveDirectMessageQuota: vi.fn(),
  finalizeDirectMessageQuotaReservation: vi.fn(),
}));

vi.mock('@/lib/twilio', async () => {
  const actual = await vi.importActual<typeof import('@/lib/twilio')>('@/lib/twilio');
  return {
    ...actual,
    sendSMS: vi.fn(),
  };
});

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import {
  finalizeDirectMessageQuotaReservation,
  reserveDirectMessageQuota,
} from '@/lib/direct-message-quota';
import { sendSMS } from '@/lib/twilio';
import { POST } from './route';

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockCustomerFindFirst = prisma.customer.findFirst as ReturnType<typeof vi.fn>;
const mockBusinessFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockReserveDirectMessageQuota = reserveDirectMessageQuota as ReturnType<typeof vi.fn>;
const mockFinalizeDirectMessageQuotaReservation =
  finalizeDirectMessageQuotaReservation as ReturnType<typeof vi.fn>;
const mockSendSMS = sendSMS as ReturnType<typeof vi.fn>;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/customers/cust-1/message', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function makeParams() {
  return { params: Promise.resolve({ id: 'cust-1' }) };
}

describe('POST /api/customers/[id]/message', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({
      user: {
        businessId: 'biz-1',
      },
    });
    mockCustomerFindFirst.mockResolvedValue({
      id: 'cust-1',
      name: 'Jane Doe',
      phone: '+15551234567',
      smsConsent: true,
      smsOptedOut: false,
    });
    mockBusinessFindUnique.mockResolvedValue({
      id: 'biz-1',
      name: 'Test Salon',
    });
    mockReserveDirectMessageQuota.mockResolvedValue({
      allowed: true,
      logId: 'log-1',
      quota: {
        limit: 25,
        used: 1,
        remaining: 24,
        periodStart: new Date('2026-03-01T00:00:00.000Z'),
        periodEnd: new Date('2026-04-01T00:00:00.000Z'),
        isActive: true,
        plan: 'starter',
      },
    });
    mockSendSMS.mockResolvedValue({
      success: true,
      sid: 'SM123',
    });
    mockFinalizeDirectMessageQuotaReservation.mockResolvedValue({});
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await POST(makeRequest({ message: 'Hello there' }), makeParams());

    expect(response.status).toBe(401);
    expect(mockSendSMS).not.toHaveBeenCalled();
  });

  it('uses the shared SMS sender, reserves quota, and returns the remaining quota', async () => {
    const response = await POST(makeRequest({ message: 'See you tomorrow.' }), makeParams());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockReserveDirectMessageQuota).toHaveBeenCalledWith({
      businessId: 'biz-1',
      toPhone: '+15551234567',
      message: 'Test Salon: See you tomorrow. Reply STOP to opt out, HELP for help.',
    });
    expect(mockSendSMS).toHaveBeenCalledWith({
      to: '+15551234567',
      message: 'Test Salon: See you tomorrow. Reply STOP to opt out, HELP for help.',
    });
    expect(mockFinalizeDirectMessageQuotaReservation).toHaveBeenCalledWith({
      logId: 'log-1',
      success: true,
      sid: 'SM123',
      error: null,
    });
    expect(body.quota.remaining).toBe(24);
  });

  it('returns a quota-specific 403 when the monthly direct message limit is reached', async () => {
    mockReserveDirectMessageQuota.mockResolvedValue({
      allowed: false,
      code: 'DIRECT_MESSAGE_LIMIT_REACHED',
      error: 'Monthly direct message limit reached for this subscription period',
      quota: {
        limit: 25,
        used: 25,
        remaining: 0,
        periodStart: new Date('2026-03-01T00:00:00.000Z'),
        periodEnd: new Date('2026-04-01T00:00:00.000Z'),
        isActive: true,
        plan: 'starter',
      },
    });

    const response = await POST(makeRequest({ message: 'See you tomorrow.' }), makeParams());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('DIRECT_MESSAGE_LIMIT_REACHED');
    expect(body.quota.remaining).toBe(0);
    expect(mockSendSMS).not.toHaveBeenCalled();
  });

  it('blocks direct messages when the customer has opted out of SMS', async () => {
    mockCustomerFindFirst.mockResolvedValue({
      id: 'cust-1',
      name: 'Jane Doe',
      phone: '+15551234567',
      smsConsent: true,
      smsOptedOut: true,
    });

    const response = await POST(makeRequest({ message: 'See you tomorrow.' }), makeParams());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/opted out/i);
    expect(mockSendSMS).not.toHaveBeenCalled();
    expect(mockReserveDirectMessageQuota).not.toHaveBeenCalled();
  });

  it('returns a subscription-required response when the business is inactive', async () => {
    mockReserveDirectMessageQuota.mockResolvedValue({
      allowed: false,
      code: 'SUBSCRIPTION_REQUIRED',
      error: 'Active subscription required',
      quota: {
        limit: 25,
        used: 0,
        remaining: 25,
        periodStart: new Date('2026-03-01T00:00:00.000Z'),
        periodEnd: new Date('2026-04-01T00:00:00.000Z'),
        isActive: false,
        plan: 'starter',
      },
    });

    const response = await POST(makeRequest({ message: 'See you tomorrow.' }), makeParams());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('SUBSCRIPTION_REQUIRED');
    expect(mockSendSMS).not.toHaveBeenCalled();
  });
});
