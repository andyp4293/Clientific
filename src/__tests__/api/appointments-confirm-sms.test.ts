import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    appointment: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    service: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('@/lib/twilio', () => ({
  sendAppointmentBusinessConfirmed: vi.fn().mockResolvedValue({ success: true }),
  sendAppointmentCancellation: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock('@/lib/appointment-reminders', () => ({
  scheduleAppointmentReminder: vi.fn().mockResolvedValue({ success: true, sid: 'SM_reminder' }),
  cancelScheduledAppointmentReminder: vi.fn().mockResolvedValue({ success: true, canceledCount: 1 }),
}));
vi.mock('@/lib/appointment-short-id', () => ({
  ensureAppointmentShortId: vi.fn().mockResolvedValue('ABC1234'),
}));

vi.mock('@/lib/subscription', () => ({
  requireActiveSubscription: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/segment', () => ({
  updateCustomerSegment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ GET: vi.fn(), POST: vi.fn() })),
  getServerSession: vi.fn(),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma';
import { sendAppointmentBusinessConfirmed } from '@/lib/twilio';
import {
  cancelScheduledAppointmentReminder,
  scheduleAppointmentReminder,
} from '@/lib/appointment-reminders';
import { getServerSession } from 'next-auth';
import { DELETE, PATCH } from '@/app/api/appointments/[id]/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockSession = {
  user: { email: 'owner@example.com', businessId: 'biz-1' },
};

const mockBusiness = {
  id: 'biz-1',
  name: 'Test Salon',
  email: 'owner@example.com',
  timezone: 'America/New_York',
  vapiPhoneNumber: '+18557654989',
};
const mockScheduleAppointmentReminder = scheduleAppointmentReminder as ReturnType<typeof vi.fn>;
const mockCancelScheduledAppointmentReminder =
  cancelScheduledAppointmentReminder as ReturnType<typeof vi.fn>;

function makeAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'appt-1',
    businessId: 'biz-1',
    customerId: 'cust-1',
    status: 'pending',
    source: 'ai',
    startTime: new Date('2026-03-10T14:00:00Z'),
    endTime: new Date('2026-03-10T15:00:00Z'),
    duration: 60,
    serviceIds: ['svc-1'],
    shortId: 'ABC1234',
    service: { name: 'Haircut' },
    customer: {
      phone: '+15551234567',
      smsConsent: true,
      smsOptedOut: false,
    },
    ...overrides,
  };
}

function makeUpdatedAppointment(appt: ReturnType<typeof makeAppointment>) {
  return {
    ...appt,
    status: 'confirmed',
    customer: { ...appt.customer, name: 'Jane Doe' },
    service: appt.service,
    staff: null,
  };
}

function patchRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/appointments/appt-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PATCH /api/appointments/[id] — confirmed SMS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.business.findUnique).mockResolvedValue(mockBusiness as any);
    mockScheduleAppointmentReminder.mockResolvedValue({ success: true, sid: 'SM_reminder' });
    mockCancelScheduledAppointmentReminder.mockResolvedValue({ success: true, canceledCount: 1 });
  });

  describe('AI receptionist bookings (status: pending, source: ai)', () => {
    it('sends confirmed SMS when business confirms an AI-booked appointment', async () => {
      const appt = makeAppointment({ status: 'pending', source: 'ai' });
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(appt as any);
      vi.mocked(prisma.appointment.update).mockResolvedValue(makeUpdatedAppointment(appt) as any);

      const res = await PATCH(patchRequest({ status: 'confirmed' }), {
        params: Promise.resolve({ id: 'appt-1' }),
      });

      expect(res.status).toBe(200);
      expect(sendAppointmentBusinessConfirmed).toHaveBeenCalledOnce();
      expect(scheduleAppointmentReminder).toHaveBeenCalledOnce();
      expect(sendAppointmentBusinessConfirmed).toHaveBeenCalledWith(
        '+15551234567',
        expect.objectContaining({
          businessName: 'Test Salon',
          serviceName: 'Haircut',
          senderPhone: '+18557654989',
        })
      );
    });

    it('does NOT send confirmed SMS if customer has no phone', async () => {
      const appt = makeAppointment({ status: 'pending', source: 'ai', customer: { phone: null, smsConsent: true, smsOptedOut: false } });
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(appt as any);
      vi.mocked(prisma.appointment.update).mockResolvedValue(makeUpdatedAppointment(appt) as any);

      await PATCH(patchRequest({ status: 'confirmed' }), {
        params: Promise.resolve({ id: 'appt-1' }),
      });

      expect(sendAppointmentBusinessConfirmed).not.toHaveBeenCalled();
      expect(scheduleAppointmentReminder).not.toHaveBeenCalled();
    });

    it('does NOT send confirmed SMS if smsConsent is false', async () => {
      const appt = makeAppointment({ status: 'pending', source: 'ai', customer: { phone: '+15551234567', smsConsent: false, smsOptedOut: false } });
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(appt as any);
      vi.mocked(prisma.appointment.update).mockResolvedValue(makeUpdatedAppointment(appt) as any);

      await PATCH(patchRequest({ status: 'confirmed' }), {
        params: Promise.resolve({ id: 'appt-1' }),
      });

      expect(sendAppointmentBusinessConfirmed).not.toHaveBeenCalled();
      expect(scheduleAppointmentReminder).not.toHaveBeenCalled();
    });

    it('does NOT send confirmed SMS if customer has opted out', async () => {
      const appt = makeAppointment({ status: 'pending', source: 'ai', customer: { phone: '+15551234567', smsConsent: true, smsOptedOut: true } });
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(appt as any);
      vi.mocked(prisma.appointment.update).mockResolvedValue(makeUpdatedAppointment(appt) as any);

      await PATCH(patchRequest({ status: 'confirmed' }), {
        params: Promise.resolve({ id: 'appt-1' }),
      });

      expect(sendAppointmentBusinessConfirmed).not.toHaveBeenCalled();
      expect(scheduleAppointmentReminder).not.toHaveBeenCalled();
    });

    it('does NOT send confirmed SMS if appointment is already confirmed', async () => {
      const appt = makeAppointment({ status: 'confirmed', source: 'ai' });
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(appt as any);
      vi.mocked(prisma.appointment.update).mockResolvedValue(makeUpdatedAppointment(appt) as any);

      await PATCH(patchRequest({ status: 'confirmed' }), {
        params: Promise.resolve({ id: 'appt-1' }),
      });

      expect(sendAppointmentBusinessConfirmed).not.toHaveBeenCalled();
      expect(scheduleAppointmentReminder).not.toHaveBeenCalled();
    });
  });

  describe('Online booking widget (status: pending, source: online)', () => {
    it('sends confirmed SMS when business confirms an online-booked appointment', async () => {
      const appt = makeAppointment({ status: 'pending', source: 'online' });
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(appt as any);
      vi.mocked(prisma.appointment.update).mockResolvedValue(makeUpdatedAppointment(appt) as any);

      const res = await PATCH(patchRequest({ status: 'confirmed' }), {
        params: Promise.resolve({ id: 'appt-1' }),
      });

      expect(res.status).toBe(200);
      expect(sendAppointmentBusinessConfirmed).toHaveBeenCalledOnce();
      expect(scheduleAppointmentReminder).toHaveBeenCalledOnce();
      expect(sendAppointmentBusinessConfirmed).toHaveBeenCalledWith(
        '+15551234567',
        expect.objectContaining({
          businessName: 'Test Salon',
          serviceName: 'Haircut',
          senderPhone: '+18557654989',
        })
      );
    });

    it('does NOT send confirmed SMS if smsConsent is false (online booking without consent checked)', async () => {
      const appt = makeAppointment({ status: 'pending', source: 'online', customer: { phone: '+15551234567', smsConsent: false, smsOptedOut: false } });
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(appt as any);
      vi.mocked(prisma.appointment.update).mockResolvedValue(makeUpdatedAppointment(appt) as any);

      await PATCH(patchRequest({ status: 'confirmed' }), {
        params: Promise.resolve({ id: 'appt-1' }),
      });

      expect(sendAppointmentBusinessConfirmed).not.toHaveBeenCalled();
      expect(scheduleAppointmentReminder).not.toHaveBeenCalled();
    });
  });

  describe('Dashboard manual bookings (status: scheduled, source: dashboard)', () => {
    it('sends confirmed SMS when business confirms a manually-created appointment', async () => {
      const appt = makeAppointment({ status: 'scheduled', source: 'dashboard' });
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(appt as any);
      vi.mocked(prisma.appointment.update).mockResolvedValue(makeUpdatedAppointment(appt) as any);

      const res = await PATCH(patchRequest({ status: 'confirmed' }), {
        params: Promise.resolve({ id: 'appt-1' }),
      });

      expect(res.status).toBe(200);
      expect(sendAppointmentBusinessConfirmed).toHaveBeenCalledOnce();
      expect(scheduleAppointmentReminder).toHaveBeenCalledOnce();
    });
  });

  describe('Non-confirm status updates', () => {
    it('does NOT send confirmed SMS when updating to completed', async () => {
      const appt = makeAppointment({ status: 'confirmed' });
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(appt as any);
      vi.mocked(prisma.appointment.update).mockResolvedValue({ ...makeUpdatedAppointment(appt), status: 'completed' } as any);

      await PATCH(patchRequest({ status: 'completed' }), {
        params: Promise.resolve({ id: 'appt-1' }),
      });

      expect(sendAppointmentBusinessConfirmed).not.toHaveBeenCalled();
      expect(scheduleAppointmentReminder).not.toHaveBeenCalled();
    });

    it('does NOT send confirmed SMS when updating notes only', async () => {
      const appt = makeAppointment({ status: 'pending' });
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(appt as any);
      vi.mocked(prisma.appointment.update).mockResolvedValue({ ...makeUpdatedAppointment(appt), status: 'pending' } as any);

      await PATCH(patchRequest({ notes: 'bring photo reference' }), {
        params: Promise.resolve({ id: 'appt-1' }),
      });

      expect(sendAppointmentBusinessConfirmed).not.toHaveBeenCalled();
      expect(scheduleAppointmentReminder).not.toHaveBeenCalled();
    });
  });

  describe('reminder resync and cancellation', () => {
    it('cancels and reschedules reminders when a confirmed appointment time changes', async () => {
      const appt = makeAppointment({
        status: 'confirmed',
        reminderSent: true,
      });
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(appt as any);
      vi.mocked(prisma.appointment.update)
        .mockResolvedValueOnce({ ...makeUpdatedAppointment(appt), startTime: new Date('2026-03-10T15:00:00Z') } as any)
        .mockResolvedValueOnce({ id: 'appt-1', reminderSent: true } as any);

      const res = await PATCH(
        patchRequest({
          startTime: '2026-03-10T15:00:00.000Z',
          duration: 60,
        }),
        {
          params: Promise.resolve({ id: 'appt-1' }),
        },
      );

      expect(res.status).toBe(200);
      expect(cancelScheduledAppointmentReminder).toHaveBeenCalledOnce();
      expect(scheduleAppointmentReminder).toHaveBeenCalledOnce();
    });

    it('cancels scheduled reminders when deleting an appointment', async () => {
      const appt = {
        ...makeUpdatedAppointment(makeAppointment({ status: 'confirmed', reminderSent: true })),
        serviceIds: ['svc-1'],
        shortId: 'ABC1234',
        business: {
          name: 'Test Salon',
          timezone: 'America/New_York',
          vapiPhoneNumber: '+18557654989',
        },
      };
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(appt as any);
      vi.mocked(prisma.appointment.delete as any).mockResolvedValue({ id: 'appt-1' });

      const req = new NextRequest('http://localhost/api/appointments/appt-1', {
        method: 'DELETE',
      });
      const res = await DELETE(req, { params: Promise.resolve({ id: 'appt-1' }) });

      expect(res.status).toBe(200);
      expect(cancelScheduledAppointmentReminder).toHaveBeenCalledOnce();
    });
  });

  describe('Auth and validation', () => {
    it('returns 401 if not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      const res = await PATCH(patchRequest({ status: 'confirmed' }), {
        params: Promise.resolve({ id: 'appt-1' }),
      });

      expect(res.status).toBe(401);
      expect(sendAppointmentBusinessConfirmed).not.toHaveBeenCalled();
    });

    it('returns 404 if appointment not found', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);

      const res = await PATCH(patchRequest({ status: 'confirmed' }), {
        params: Promise.resolve({ id: 'appt-1' }),
      });

      expect(res.status).toBe(404);
      expect(sendAppointmentBusinessConfirmed).not.toHaveBeenCalled();
    });
  });
});
