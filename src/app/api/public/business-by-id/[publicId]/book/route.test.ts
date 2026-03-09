import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    service: { findMany: vi.fn() },
    staff: { findFirst: vi.fn() },
    appointment: { findMany: vi.fn(), create: vi.fn() },
    customer: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    notification: { create: vi.fn() },
    smsConsentEvent: { create: vi.fn() },
  },
}));

vi.mock('@/lib/twilio', () => ({
  sendAppointmentConfirmation: vi.fn().mockResolvedValue({ success: true }),
  formatPhoneNumber: vi.fn((p: string) => p),
}));

vi.mock('@/lib/email', () => ({
  sendNewBookingEmail: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '@/lib/prisma';
import { sendAppointmentConfirmation } from '@/lib/twilio';
import { POST } from './route';

function req(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/public/business-by-id/pub_123/book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const BASE_BODY = {
  serviceIds: ['svc-1'],
  startTime: '2026-03-10T14:00:00.000Z',
  duration: 60,
  customerName: 'Jane',
  customerPhone: '+15551234567',
};

describe('POST /api/public/business-by-id/[publicId]/book', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      enableOnlineBooking: true,
      email: 'owner@test.com',
      name: 'Test Salon',
      timezone: 'America/New_York',
      notifyNewBookingEmail: false,
      vapiPhoneNumber: '+18557654989',
    } as any);
    vi.mocked(prisma.service.findMany).mockResolvedValue([{ id: 'svc-1', name: 'Haircut' }] as any);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.customer.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.customer.create).mockResolvedValue({
      id: 'cust-1',
      name: 'Jane',
      phone: '+15551234567',
      smsOptedOut: false,
    } as any);
    vi.mocked(prisma.appointment.create).mockResolvedValue({
      id: 'appt-1',
      startTime: new Date('2026-03-10T14:00:00.000Z'),
      duration: 60,
      customer: { id: 'cust-1', name: 'Jane', phone: '+15551234567' },
      service: { name: 'Haircut' },
      staff: null,
      business: { name: 'Test Salon' },
    } as any);
    vi.mocked(prisma.smsConsentEvent.create).mockResolvedValue({ id: 'evt-1' } as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: 'notif-1' } as any);
  });

  it('uses business AI number as sender for booking confirmation SMS', async () => {
    const res = await POST(
      req({
        ...BASE_BODY,
        smsConsent: true,
      }),
      { params: Promise.resolve({ publicId: 'pub_123' }) }
    );

    expect(res.status).toBe(200);
    expect(sendAppointmentConfirmation).toHaveBeenCalledWith(
      '+15551234567',
      expect.objectContaining({
        senderPhone: '+18557654989',
      })
    );
  });
});
