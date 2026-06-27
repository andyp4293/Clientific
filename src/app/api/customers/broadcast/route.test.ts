import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

vi.mock('@/lib/subscription', () => ({
  requireActiveSubscription: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
    },
    customerGroup: {
      findMany: vi.fn(),
    },
    customer: {
      findMany: vi.fn(),
    },
    smsLog: {
      createMany: vi.fn(),
    },
  },
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
import { sendSMS } from '@/lib/twilio';
import { POST } from './route';

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockBusinessFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockGroupFindMany = prisma.customerGroup.findMany as ReturnType<typeof vi.fn>;
const mockCustomerFindMany = prisma.customer.findMany as ReturnType<typeof vi.fn>;
const mockSmsLogCreateMany = prisma.smsLog.createMany as ReturnType<typeof vi.fn>;
const mockSendSMS = sendSMS as ReturnType<typeof vi.fn>;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/customers/broadcast', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/customers/broadcast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({
      user: {
        businessId: 'biz-1',
      },
    });
    mockBusinessFindUnique.mockResolvedValue({
      id: 'biz-1',
      name: 'Test Salon',
    });
    mockGroupFindMany.mockResolvedValue([]);
    mockCustomerFindMany.mockResolvedValue([
      {
        id: 'cust-1',
        name: 'Ana',
        phone: '+15551234567',
      },
      {
        id: 'cust-2',
        name: 'Ben',
        phone: '(555) 123-4567',
      },
      {
        id: 'cust-3',
        name: 'Cara',
        phone: '+15557654321',
      },
    ]);
    mockSmsLogCreateMany.mockResolvedValue({ count: 2 });
    mockSendSMS.mockResolvedValue({
      success: true,
      sid: 'SM123',
    });
  });

  it('dry-runs the all-subscriber audience without sending SMS or writing logs', async () => {
    const response = await POST(makeRequest({ dryRun: true, target: 'all' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      dryRun: true,
      target: 'all',
      eligibleCount: 2,
      skippedDuplicateCount: 1,
      skippedInvalidPhoneCount: 0,
      sent: 0,
      failed: 0,
    });
    expect(mockCustomerFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'biz-1',
          smsMarketingConsent: true,
          smsOptedOut: false,
          dealSmsBlocked: false,
          phone: { not: null },
        }),
      }),
    );
    expect(mockSendSMS).not.toHaveBeenCalled();
    expect(mockSmsLogCreateMany).not.toHaveBeenCalled();
  });

  it('requires selected groups for a group broadcast dry run', async () => {
    const response = await POST(makeRequest({ dryRun: true, target: 'groups', groupIds: [] }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/select at least one customer group/i);
    expect(mockSendSMS).not.toHaveBeenCalled();
  });

  it('dry-runs a group audience with the selected promotion-SMS groups', async () => {
    mockGroupFindMany.mockResolvedValue([
      {
        id: 'group-1',
        name: 'VIP',
        promotionSmsEnabled: true,
      },
      {
        id: 'group-2',
        name: 'Dormant',
        promotionSmsEnabled: false,
      },
    ]);

    const response = await POST(
      makeRequest({
        dryRun: true,
        target: 'groups',
        groupIds: ['group-1', 'group-2'],
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.selectedGroups).toHaveLength(2);
    expect(body.disabledGroupCount).toBe(1);
    expect(mockCustomerFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            expect.objectContaining({
              businessId: 'biz-1',
              smsMarketingConsent: true,
            }),
            {
              groupMemberships: {
                some: {
                  groupId: { in: ['group-1', 'group-2'] },
                  group: {
                    businessId: 'biz-1',
                    promotionSmsEnabled: true,
                  },
                },
              },
            },
          ],
        },
      }),
    );
    expect(mockSendSMS).not.toHaveBeenCalled();
  });

  it('requires explicit confirmation before sending a real broadcast', async () => {
    const response = await POST(makeRequest({ target: 'all', message: 'Hello subscribers' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/confirm/i);
    expect(mockSendSMS).not.toHaveBeenCalled();
  });

  it('sends a confirmed broadcast, logs every attempt, and reports failures', async () => {
    mockSendSMS
      .mockResolvedValueOnce({ success: true, sid: 'SM1' })
      .mockResolvedValueOnce({ success: false, error: 'carrier rejected' });

    const response = await POST(
      makeRequest({
        target: 'all',
        message: 'We have openings today.',
        confirmSend: true,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockSendSMS).toHaveBeenCalledTimes(2);
    expect(mockSendSMS).toHaveBeenNthCalledWith(1, {
      to: '+15551234567',
      message: 'Test Salon: We have openings today. Reply STOP to opt out, HELP for help.',
    });
    expect(mockSmsLogCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          businessId: 'biz-1',
          toPhone: '+15551234567',
          messageType: 'customer_broadcast',
          status: 'sent',
          twilioSid: 'SM1',
        }),
        expect.objectContaining({
          businessId: 'biz-1',
          toPhone: '+15557654321',
          messageType: 'customer_broadcast',
          status: 'failed',
          errorMessage: 'carrier rejected',
        }),
      ],
    });
    expect(body).toMatchObject({
      dryRun: false,
      eligibleCount: 2,
      sent: 1,
      failed: 1,
    });
  });
});
