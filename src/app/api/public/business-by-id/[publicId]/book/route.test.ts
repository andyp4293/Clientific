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
      businessHours: {
        hours: {
          0: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          1: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          2: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          3: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          4: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          5: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          6: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        },
      },
      closureDates: [],
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

  it('stores both transactional and marketing consent on new customer + logs FORM_OPT_IN', async () => {
    const res = await POST(
      req({
        ...BASE_BODY,
        smsConsent: true,
        smsMarketingConsent: true,
      }),
      { params: Promise.resolve({ publicId: 'pub_123' }) }
    );

    expect(res.status).toBe(200);
    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'biz-1',
          smsConsent: true,
          smsMarketingConsent: true,
          smsMarketingConsentAt: expect.any(Date),
        }),
      })
    );
    expect(prisma.smsConsentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'FORM_OPT_IN',
          source: 'booking_form',
          metadata: expect.objectContaining({
            transactionalConsent: true,
            marketingConsent: true,
            channel: 'public-business-public-id-book',
          }),
        }),
      })
    );
    expect(sendAppointmentConfirmation).toHaveBeenCalledWith(
      '+15551234567',
      expect.objectContaining({
        senderPhone: '+18557654989',
      })
    );
  });

  it('allows marketing opt-in without turning on transactional consent', async () => {
    vi.mocked(prisma.customer.findFirst).mockResolvedValue({
      id: 'cust-1',
      smsOptedOut: false,
      phone: '+15551234567',
      name: 'Jane',
    } as any);
    vi.mocked(prisma.customer.update).mockResolvedValue({
      id: 'cust-1',
      name: 'Jane',
      phone: '+15551234567',
      smsOptedOut: false,
    } as any);

    const res = await POST(
      req({
        ...BASE_BODY,
        smsConsent: false,
        smsMarketingConsent: true,
      }),
      { params: Promise.resolve({ publicId: 'pub_123' }) }
    );

    expect(res.status).toBe(200);
    const updateArgs = vi.mocked(prisma.customer.update).mock.calls[0][0] as any;
    expect(updateArgs.data.smsMarketingConsent).toBe(true);
    expect(updateArgs.data.smsMarketingConsentAt).toBeInstanceOf(Date);
    expect(updateArgs.data.smsConsent).toBeUndefined();
    expect(prisma.smsConsentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            transactionalConsent: false,
            marketingConsent: true,
            channel: 'public-business-public-id-book',
          }),
        }),
      })
    );
    expect(sendAppointmentConfirmation).not.toHaveBeenCalled();
  });

  it('blocks booking when the requested staff member is off that business-local day', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      id: 'staff-1',
      fullName: 'Andy',
      workDays: [1],
      serviceAssignments: [],
    } as any);

    const res = await POST(
      req({
        ...BASE_BODY,
        staffId: 'staff-1',
      }),
      { params: Promise.resolve({ publicId: 'pub_123' }) }
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "Andy doesn't work on that day.",
    });
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it('blocks booking on a specific closed date before creating the appointment', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      enableOnlineBooking: true,
      email: 'owner@test.com',
      name: 'Test Salon',
      timezone: 'America/New_York',
      notifyNewBookingEmail: false,
      vapiPhoneNumber: '+18557654989',
      businessHours: {
        hours: {
          2: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        },
      },
      closureDates: [{ date: '2026-03-10', label: 'Training Day' }],
    } as any);

    const res = await POST(
      req(BASE_BODY),
      { params: Promise.resolve({ publicId: 'pub_123' }) }
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: 'Business is closed for Training Day.',
    });
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it('blocks booking when the requested time is outside the staff member’s hours', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      id: 'staff-1',
      fullName: 'Andy',
      workDays: [2],
      workHours: {
        2: { startTime: '10:00', endTime: '16:00' },
      },
      serviceAssignments: [],
    } as any);

    const res = await POST(
      req({
        ...BASE_BODY,
        staffId: 'staff-1',
        startTime: '2026-03-10T13:00:00.000Z',
      }),
      { params: Promise.resolve({ publicId: 'pub_123' }) }
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining('Andy is available Tuesday from 10:00 AM to 4:00 PM.'),
    });
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });
});
