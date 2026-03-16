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
    smsLog: {
      create: vi.fn(),
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
const mockCustomerFindFirst = prisma.customer.findFirst as ReturnType<typeof vi.fn>;
const mockBusinessFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockSmsLogCreate = prisma.smsLog.create as ReturnType<typeof vi.fn>;
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
      vapiPhoneNumber: '+15557654321',
      smsAiPhoneNumber: null,
    });
    mockSendSMS.mockResolvedValue({
      success: true,
      sid: 'SM123',
    });
    mockSmsLogCreate.mockResolvedValue({});
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await POST(makeRequest({ message: 'Hello there' }), makeParams());

    expect(response.status).toBe(401);
    expect(mockSendSMS).not.toHaveBeenCalled();
  });

  it('uses the shared SMS sender for direct messages, prefixes the business name, and logs the full outbound message', async () => {
    const response = await POST(makeRequest({ message: 'See you tomorrow.' }), makeParams());

    expect(response.status).toBe(200);
    expect(mockSendSMS).toHaveBeenCalledWith({
      to: '+15551234567',
      message: 'Test Salon: See you tomorrow. Reply STOP to opt out, HELP for help.',
    });
    expect(mockSmsLogCreate).toHaveBeenCalledWith({
      data: {
        businessId: 'biz-1',
        toPhone: '+15551234567',
        message: 'Test Salon: See you tomorrow. Reply STOP to opt out, HELP for help.',
        messageType: 'custom',
        status: 'sent',
        twilioSid: 'SM123',
        errorMessage: null,
      },
    });
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
    expect(mockSmsLogCreate).not.toHaveBeenCalled();
  });
});
