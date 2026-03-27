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
      findUnique: vi.fn(),
    },
    smsLog: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/direct-message-quota', () => ({
  getDirectMessageQuotaStatus: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { getDirectMessageQuotaStatus } from '@/lib/direct-message-quota';
import { GET } from './route';

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockCustomerFindUnique = prisma.customer.findUnique as ReturnType<typeof vi.fn>;
const mockSmsLogFindMany = prisma.smsLog.findMany as ReturnType<typeof vi.fn>;
const mockGetDirectMessageQuotaStatus = getDirectMessageQuotaStatus as ReturnType<typeof vi.fn>;

function makeRequest() {
  return new NextRequest('http://localhost/api/customers/cust-1/sms-logs');
}

function makeParams() {
  return { params: Promise.resolve({ id: 'cust-1' }) };
}

describe('GET /api/customers/[id]/sms-logs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({
      user: {
        id: 'biz-1',
        businessId: 'biz-1',
      },
    });
    mockCustomerFindUnique.mockResolvedValue({
      phone: '+15551234567',
      businessId: 'biz-1',
    });
    mockSmsLogFindMany.mockResolvedValue([
      {
        id: 'log-1',
        message: 'Test Salon: See you tomorrow.',
        status: 'sent',
        messageType: 'custom',
        createdAt: new Date('2026-03-20T12:00:00.000Z'),
      },
    ]);
    mockGetDirectMessageQuotaStatus.mockResolvedValue({
      limit: 25,
      used: 1,
      remaining: 24,
      periodStart: new Date('2026-03-01T00:00:00.000Z'),
      periodEnd: new Date('2026-04-01T00:00:00.000Z'),
      isActive: true,
      plan: 'starter',
    });
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(401);
  });

  it('returns logs plus direct message quota information', async () => {
    const response = await GET(makeRequest(), makeParams());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.logs).toHaveLength(1);
    expect(body.quota.remaining).toBe(24);
    expect(mockGetDirectMessageQuotaStatus).toHaveBeenCalledWith('biz-1');
    expect(mockSmsLogFindMany).toHaveBeenCalledWith({
      where: { businessId: 'biz-1', toPhone: '+15551234567' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  it('returns an empty log list plus quota info when the customer has no phone number', async () => {
    mockCustomerFindUnique.mockResolvedValue({
      phone: null,
      businessId: 'biz-1',
    });

    const response = await GET(makeRequest(), makeParams());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.logs).toEqual([]);
    expect(body.quota.limit).toBe(25);
    expect(mockSmsLogFindMany).not.toHaveBeenCalled();
  });
});
