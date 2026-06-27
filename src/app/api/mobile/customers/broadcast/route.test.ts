import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-route', () => ({
  requireMobileSession: vi.fn(),
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

import { requireMobileSession } from '@/lib/mobile-route';
import { prisma } from '@/lib/prisma';
import { sendSMS } from '@/lib/twilio';
import { POST } from './route';

const mockRequireMobileSession = requireMobileSession as ReturnType<typeof vi.fn>;
const mockBusinessFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockGroupFindMany = prisma.customerGroup.findMany as ReturnType<typeof vi.fn>;
const mockCustomerFindMany = prisma.customer.findMany as ReturnType<typeof vi.fn>;
const mockSmsLogCreateMany = prisma.smsLog.createMany as ReturnType<typeof vi.fn>;
const mockSendSMS = sendSMS as ReturnType<typeof vi.fn>;

function makeRequest(body: Record<string, unknown>) {
  return new Request('https://www.clientific.app/api/mobile/customers/broadcast', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/mobile/customers/broadcast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireMobileSession.mockResolvedValue({
      session: {
        businessId: 'biz-1',
      },
    });
    mockBusinessFindUnique.mockResolvedValue({
      id: 'biz-1',
      name: 'Mobile Salon',
    });
    mockGroupFindMany.mockResolvedValue([]);
    mockCustomerFindMany.mockResolvedValue([
      {
        id: 'cust-1',
        name: 'Ana',
        phone: '+15551234567',
      },
    ]);
    mockSmsLogCreateMany.mockResolvedValue({ count: 1 });
    mockSendSMS.mockResolvedValue({
      success: true,
      sid: 'SM123',
    });
  });

  it('dry-runs without sending customers any SMS', async () => {
    const response = await POST(makeRequest({ dryRun: true, target: 'all' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      dryRun: true,
      eligibleCount: 1,
      sent: 0,
      failed: 0,
    });
    expect(mockSendSMS).not.toHaveBeenCalled();
    expect(mockSmsLogCreateMany).not.toHaveBeenCalled();
  });

  it('sends only after mobile confirmation is included', async () => {
    const unconfirmed = await POST(makeRequest({ target: 'all', message: 'Hi' }));
    expect(unconfirmed.status).toBe(400);
    expect(mockSendSMS).not.toHaveBeenCalled();

    const confirmed = await POST(
      makeRequest({
        target: 'all',
        message: 'Hi',
        confirmSend: true,
      }),
    );
    const body = await confirmed.json();

    expect(confirmed.status).toBe(200);
    expect(mockSendSMS).toHaveBeenCalledWith({
      to: '+15551234567',
      message: 'Mobile Salon: Hi Reply STOP to opt out, HELP for help.',
    });
    expect(body.sent).toBe(1);
  });

  it('rejects missing mobile auth before calculating audiences', async () => {
    mockRequireMobileSession.mockResolvedValue({
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const response = await POST(makeRequest({ dryRun: true, target: 'all' }));

    expect(response.status).toBe(401);
    expect(mockCustomerFindMany).not.toHaveBeenCalled();
    expect(mockSendSMS).not.toHaveBeenCalled();
  });
});
