import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-route', () => ({
  requireMobileSession: vi.fn(),
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
vi.mock('@/lib/twilio', () => ({
  formatDirectCustomerMessageSMS: vi.fn(({ businessName, message }) => `${businessName}: ${message}`),
  sendSMS: vi.fn(),
}));

import { requireMobileSession } from '@/lib/mobile-route';
import { prisma } from '@/lib/prisma';
import {
  finalizeDirectMessageQuotaReservation,
  reserveDirectMessageQuota,
} from '@/lib/direct-message-quota';
import { sendSMS } from '@/lib/twilio';
import { POST } from './route';

const mockRequireMobileSession = requireMobileSession as ReturnType<typeof vi.fn>;
const mockFindCustomer = prisma.customer.findFirst as ReturnType<typeof vi.fn>;
const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockReserveQuota = reserveDirectMessageQuota as ReturnType<typeof vi.fn>;
const mockFinalizeQuota = finalizeDirectMessageQuotaReservation as ReturnType<typeof vi.fn>;
const mockSendSms = sendSMS as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileSession.mockResolvedValue({ session: { businessId: 'biz-1' } });
});

describe('POST /api/mobile/customers/[id]/message', () => {
  it('sends a direct customer message and returns quota details', async () => {
    mockFindCustomer.mockResolvedValue({
      id: 'cust-1',
      name: 'Jordan Lee',
      phone: '+15551234567',
      smsConsent: true,
      smsOptedOut: false,
    });
    mockFindBusiness.mockResolvedValue({
      id: 'biz-1',
      name: 'Clientific Studio',
    });
    mockReserveQuota.mockResolvedValue({
      allowed: true,
      logId: 'log-1',
      quota: {
        limit: 25,
        used: 5,
        remaining: 20,
        periodEnd: '2026-04-30T00:00:00.000Z',
        isActive: true,
      },
    });
    mockSendSms.mockResolvedValue({ success: true, sid: 'SM123' });

    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/customers/cust-1/message', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'Thanks for visiting us!' }),
      }),
      { params: Promise.resolve({ id: 'cust-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.quota.remaining).toBe(20);
    expect(mockFinalizeQuota).toHaveBeenCalledWith(
      expect.objectContaining({
        logId: 'log-1',
        success: true,
      }),
    );
  });
});
