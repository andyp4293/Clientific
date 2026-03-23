import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findMany: vi.fn() },
    smsAiSession: { upsert: vi.fn(), update: vi.fn() },
    customer: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    service: { findFirst: vi.fn() },
    staff: { findFirst: vi.fn() },
    appointment: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    notification: { create: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { handleSmsAiInbound } from '@/lib/sms-ai';

const baseBusiness = {
  id: 'biz-1',
  name: 'Test Nail Salon',
  timezone: 'America/New_York',
  street: '123 Main St',
  city: 'Miami',
  state: 'FL',
  smsAiGreeting: 'Hi from Test Nail Salon.',
  smsAiPhoneNumber: '+18557654989',
  vapiPhoneNumber: null,
  services: [{ id: 'svc-1', name: 'Classic Manicure', duration: 60, price: 35 }],
  staff: [{ id: 'stf-1', fullName: 'Jordan', workDays: [1, 2, 3, 4, 5] }],
  businessHours: {
    hours: {
      0: { isOpen: false },
      1: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      2: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      3: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      4: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      5: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      6: { isOpen: false },
    },
  },
};

const baseSession = {
  id: 'sess-1',
  businessId: 'biz-1',
  phone: '+15551234567',
  state: 'idle',
  turns: 1,
  serviceId: null,
  staffId: null,
  requestedDate: null,
  requestedTime: null,
  selectedSlotTime: null,
  customerName: null,
  notes: null,
  pendingOptions: null,
  lastIntent: null,
  lastInboundText: null,
  lastOutboundText: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('handleSmsAiInbound', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.business.findMany).mockResolvedValue([baseBusiness] as any);
    vi.mocked(prisma.smsAiSession.upsert).mockResolvedValue(baseSession as any);
    vi.mocked(prisma.smsAiSession.update).mockResolvedValue(baseSession as any);
  });

  it('returns null when no SMS AI business is enabled', async () => {
    vi.mocked(prisma.business.findMany).mockResolvedValue([] as any);

    const result = await handleSmsAiInbound({
      fromPhoneRaw: '+15551234567',
      toPhoneRaw: '+18557654989',
      messageBody: 'book tomorrow at 3pm',
    });

    expect(result).toBeNull();
  });

  it('returns help response for help intent', async () => {
    const result = await handleSmsAiInbound({
      fromPhoneRaw: '+15551234567',
      toPhoneRaw: '+18557654989',
      messageBody: 'help',
    });

    expect(result?.eventType).toBe('AI_HELP');
    expect(result?.text).toContain('Book manicure tomorrow at 3pm');
  });

  it('asks for service when booking intent does not include a service', async () => {
    const result = await handleSmsAiInbound({
      fromPhoneRaw: '+15551234567',
      toPhoneRaw: '+18557654989',
      messageBody: 'book tomorrow at 3pm',
    });

    expect(result?.eventType).toBe('AI_BOOKING_NEEDS_SERVICE');
    expect(result?.text).toContain('Which service');
    expect(prisma.smsAiSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          state: 'booking_collect_service',
        }),
      })
    );
  });

  it('matches stored customers by lookup key and refreshes the normalized phone on booking', async () => {
    vi.mocked(prisma.smsAiSession.upsert).mockResolvedValue({
      ...baseSession,
      state: 'booking_confirm',
      serviceId: 'svc-1',
      selectedSlotTime: new Date('2026-03-23T14:00:00.000Z'),
      customerName: 'Jane',
    } as any);
    vi.mocked(prisma.service.findFirst).mockResolvedValue({
      id: 'svc-1',
      name: 'Classic Manicure',
      duration: 60,
    } as any);
    vi.mocked(prisma.customer.findMany).mockResolvedValue([{ id: 'cust-1' }] as any);
    vi.mocked(prisma.customer.findUnique).mockResolvedValue({
      id: 'cust-1',
      name: 'Old Jane',
      phone: '5551234567',
      phoneLookupKey: null,
    } as any);
    vi.mocked(prisma.customer.update).mockResolvedValue({
      id: 'cust-1',
      name: 'Jane',
      phone: '+15551234567',
      phoneLookupKey: '5551234567',
    } as any);
    vi.mocked(prisma.appointment.count).mockResolvedValue(0);
    vi.mocked(prisma.appointment.create).mockResolvedValue({ id: 'appt-1' } as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: 'notif-1' } as any);

    const result = await handleSmsAiInbound({
      fromPhoneRaw: '+15551234567',
      toPhoneRaw: '+18557654989',
      messageBody: 'yes',
    });

    expect(result?.handled).toBe(true);
    expect(result?.eventType).toBe('AI_BOOKED');
    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { phoneLookupKey: '5551234567' },
            { phone: '+15551234567' },
          ]),
        }),
      })
    );
    expect(prisma.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cust-1' },
        data: expect.objectContaining({
          phone: '+15551234567',
          phoneLookupKey: '5551234567',
        }),
      })
    );
  });
});
