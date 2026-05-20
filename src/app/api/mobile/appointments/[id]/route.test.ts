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
    appointment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/twilio', () => ({
  sendAppointmentBusinessConfirmed: vi.fn().mockResolvedValue({ success: true }),
  sendAppointmentCancellation: vi.fn().mockResolvedValue({ success: true }),
  sendAppointmentRescheduled: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/segment', () => ({
  updateCustomerSegment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/app-url', () => ({
  getConfiguredAppBaseUrl: vi.fn(() => 'https://www.clientific.app'),
}));

vi.mock('@/lib/moderation', () => ({
  blockedContentError: vi.fn(() => 'Blocked content'),
  getBlockedFieldLabel: vi.fn(() => null),
}));

vi.mock('@/lib/appointment-reminders', () => ({
  cancelScheduledAppointmentReminder: vi.fn().mockResolvedValue({ success: true }),
  scheduleAppointmentReminder: vi.fn().mockResolvedValue({ success: true, sid: 'SM_reminder' }),
}));

vi.mock('@/lib/appointment-short-id', () => ({
  ensureAppointmentShortId: vi.fn().mockResolvedValue('ABC1234'),
}));

vi.mock('@/lib/appointment-services', () => ({
  resolveAppointmentServiceDisplayName: vi.fn((appointment: { serviceIds?: string[] }) =>
    appointment.serviceIds?.includes('svc-2') ? 'Pedicure' : 'Haircut',
  ),
}));

import { requireMobileSession } from '@/lib/mobile-route';
import { requireActiveSubscription } from '@/lib/subscription';
import { prisma } from '@/lib/prisma';
import {
  sendAppointmentBusinessConfirmed,
  sendAppointmentCancellation,
  sendAppointmentRescheduled,
} from '@/lib/twilio';
import {
  cancelScheduledAppointmentReminder,
  scheduleAppointmentReminder,
} from '@/lib/appointment-reminders';
import { PATCH, DELETE } from './route';

const mockRequireMobileSession = vi.mocked(requireMobileSession);
const mockRequireActiveSubscription = vi.mocked(requireActiveSubscription);
const mockFindBusiness = vi.mocked(prisma.business.findUnique);
const mockFindAppointment = vi.mocked(prisma.appointment.findFirst);
const mockFindAppointmentConflicts = vi.mocked(prisma.appointment.findMany);
const mockUpdateAppointment = vi.mocked(prisma.appointment.update);
const mockDeleteAppointment = vi.mocked(prisma.appointment.delete);
const mockFindServices = vi.mocked(prisma.service.findMany);
const mockSendAppointmentBusinessConfirmed = vi.mocked(sendAppointmentBusinessConfirmed);
const mockSendAppointmentCancellation = vi.mocked(sendAppointmentCancellation);
const mockSendAppointmentRescheduled = vi.mocked(sendAppointmentRescheduled);
const mockCancelScheduledAppointmentReminder = vi.mocked(cancelScheduledAppointmentReminder);
const mockScheduleAppointmentReminder = vi.mocked(scheduleAppointmentReminder);

const baseAppointment = {
  id: 'appt-1',
  customerId: 'cust-1',
  duration: 60,
  notes: 'Please text me',
  status: 'pending',
  source: 'dashboard',
  shortId: 'ABC1234',
  serviceIds: ['svc-1'],
  startTime: new Date('2026-03-30T15:00:00.000Z'),
  customer: {
    id: 'cust-1',
    name: 'Jordan Lee',
    phone: '+15551234567',
    smsConsent: true,
    smsOptedOut: false,
  },
  service: {
    id: 'svc-1',
    name: 'Haircut',
  },
  staff: {
    id: 'staff-1',
    fullName: 'Taylor',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileSession.mockResolvedValue({
    session: { businessId: 'biz-1' },
  } as never);
  mockRequireActiveSubscription.mockResolvedValue(null);
  mockFindBusiness.mockResolvedValue({
    id: 'biz-1',
    name: 'Clientific Studio',
    timezone: 'America/New_York',
    vapiPhoneNumber: '+18885550123',
  } as never);
  mockFindAppointmentConflicts.mockResolvedValue([]);
  mockFindServices.mockResolvedValue([{ id: 'svc-1', name: 'Haircut' }] as never);
  mockSendAppointmentBusinessConfirmed.mockResolvedValue({ success: true } as never);
  mockSendAppointmentCancellation.mockResolvedValue({ success: true } as never);
  mockSendAppointmentRescheduled.mockResolvedValue({ success: true } as never);
  mockCancelScheduledAppointmentReminder.mockResolvedValue({ success: true } as never);
  mockScheduleAppointmentReminder.mockResolvedValue({ success: true, sid: 'SM_123' } as never);
});

describe('mobile appointment detail route', () => {
  it('propagates the staff-session block for mobile update and delete detail routes', async () => {
    const forbidden = new Response(
      JSON.stringify({ error: 'Employee accounts can only access assigned appointments.' }),
      { status: 403 },
    );
    mockRequireMobileSession.mockResolvedValueOnce({ error: forbidden } as never);

    const patchResponse = await PATCH(
      new Request('https://www.clientific.app/api/mobile/appointments/appt-1', {
        method: 'PATCH',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ status: 'confirmed' }),
      }),
      { params: Promise.resolve({ id: 'appt-1' }) },
    );

    mockRequireMobileSession.mockResolvedValueOnce({ error: forbidden } as never);
    const deleteResponse = await DELETE(
      new Request('https://www.clientific.app/api/mobile/appointments/appt-1', {
        method: 'DELETE',
        headers: {
          authorization: 'Bearer token',
        },
      }),
      { params: Promise.resolve({ id: 'appt-1' }) },
    );

    expect(patchResponse.status).toBe(403);
    expect(deleteResponse.status).toBe(403);
    expect(mockFindAppointment).not.toHaveBeenCalled();
    expect(mockUpdateAppointment).not.toHaveBeenCalled();
    expect(mockDeleteAppointment).not.toHaveBeenCalled();
  });

  it('confirms an appointment and schedules the reminder when it becomes reminder-eligible', async () => {
    mockFindAppointment.mockResolvedValueOnce({
      ...baseAppointment,
      business: undefined,
    } as never);
    mockUpdateAppointment
      .mockResolvedValueOnce({
        ...baseAppointment,
        status: 'confirmed',
        business: undefined,
      } as never)
      .mockResolvedValueOnce({ id: 'appt-1', reminderSent: true } as never);

    const response = await PATCH(
      new Request('https://www.clientific.app/api/mobile/appointments/appt-1', {
        method: 'PATCH',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ status: 'confirmed' }),
      }),
      { params: Promise.resolve({ id: 'appt-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mockUpdateAppointment).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'appt-1' },
        data: expect.objectContaining({
          status: 'confirmed',
          reminderSent: false,
        }),
      }),
    );
    expect(mockSendAppointmentBusinessConfirmed).toHaveBeenCalledWith(
      '+15551234567',
      expect.objectContaining({
        customerName: 'Jordan Lee',
        serviceName: 'Haircut',
      }),
    );
    expect(mockScheduleAppointmentReminder).toHaveBeenCalledWith(
      '+15551234567',
      expect.objectContaining({
        customerName: 'Jordan Lee',
        serviceName: 'Haircut',
      }),
    );
  });

  it('updates mobile local timing changes in the business timezone before rescheduling', async () => {
    mockFindAppointment.mockResolvedValueOnce({
      ...baseAppointment,
      status: 'confirmed',
      business: undefined,
    } as never);
    mockUpdateAppointment
      .mockResolvedValueOnce({
        ...baseAppointment,
        status: 'confirmed',
        startTime: new Date('2026-03-30T16:30:00.000Z'),
        business: undefined,
      } as never)
      .mockResolvedValueOnce({ id: 'appt-1', reminderSent: true } as never);

    const response = await PATCH(
      new Request('https://www.clientific.app/api/mobile/appointments/appt-1', {
        method: 'PATCH',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          startDate: '2026-03-30',
          startTimeLocal: '12:30',
          duration: 60,
        }),
      }),
      { params: Promise.resolve({ id: 'appt-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mockUpdateAppointment).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          startTime: '2026-03-30T16:30:00.000Z',
          endTime: new Date('2026-03-30T17:30:00.000Z'),
        }),
      }),
    );
    expect(mockCancelScheduledAppointmentReminder).toHaveBeenCalledWith(
      '+15551234567',
      expect.objectContaining({
        customerName: 'Jordan Lee',
        serviceName: 'Haircut',
      }),
    );
    expect(mockScheduleAppointmentReminder).toHaveBeenCalledWith(
      '+15551234567',
      expect.objectContaining({
        dateTime: new Date('2026-03-30T16:30:00.000Z'),
      }),
    );
  });

  it('accepts 15-minute mobile appointment duration updates', async () => {
    mockFindAppointment.mockResolvedValueOnce({
      ...baseAppointment,
      status: 'scheduled',
      serviceId: null,
      serviceIds: [],
      service: null,
      business: undefined,
    } as never);
    mockUpdateAppointment
      .mockResolvedValueOnce({
        ...baseAppointment,
        status: 'scheduled',
        serviceId: null,
        serviceIds: [],
        service: null,
        duration: 15,
        startTime: new Date('2026-03-30T16:30:00.000Z'),
        endTime: new Date('2026-03-30T16:45:00.000Z'),
        business: undefined,
      } as never)
      .mockResolvedValueOnce({ id: 'appt-1', reminderSent: true } as never);
    mockFindServices.mockResolvedValue([] as never);

    const response = await PATCH(
      new Request('https://www.clientific.app/api/mobile/appointments/appt-1', {
        method: 'PATCH',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          startDate: '2026-03-30',
          startTimeLocal: '12:30',
          duration: 15,
          serviceId: null,
          serviceIds: [],
        }),
      }),
      { params: Promise.resolve({ id: 'appt-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mockUpdateAppointment).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          duration: 15,
          endTime: new Date('2026-03-30T16:45:00.000Z'),
          serviceId: null,
          serviceIds: [],
          startTime: '2026-03-30T16:30:00.000Z',
        }),
      }),
    );
  });

  it('sends customer update SMS for online or AI bookings when service, staff, or time changes', async () => {
    mockFindAppointment.mockResolvedValueOnce({
      ...baseAppointment,
      source: 'ai',
      status: 'confirmed',
      serviceId: 'svc-1',
      staffId: 'staff-1',
      business: undefined,
    } as never);
    mockUpdateAppointment
      .mockResolvedValueOnce({
        ...baseAppointment,
        source: 'ai',
        status: 'confirmed',
        serviceIds: ['svc-2'],
        service: { id: 'svc-2', name: 'Pedicure' },
        staff: { id: 'staff-2', fullName: 'Morgan' },
        staffId: 'staff-2',
        startTime: new Date('2026-03-30T17:00:00.000Z'),
        duration: 45,
        business: undefined,
      } as never)
      .mockResolvedValueOnce({ id: 'appt-1', reminderSent: true } as never);
    mockFindServices.mockResolvedValue([{ id: 'svc-2', name: 'Pedicure' }] as never);

    const response = await PATCH(
      new Request('https://www.clientific.app/api/mobile/appointments/appt-1', {
        method: 'PATCH',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          startTime: '2026-03-30T17:00:00.000Z',
          duration: 45,
          serviceId: 'svc-2',
          serviceIds: ['svc-2'],
          staffId: 'staff-2',
        }),
      }),
      { params: Promise.resolve({ id: 'appt-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mockSendAppointmentRescheduled).toHaveBeenCalledWith(
      '+15551234567',
      expect.objectContaining({
        customerName: 'Jordan Lee',
        serviceName: 'Pedicure',
        staffName: 'Morgan',
        newDateTime: new Date('2026-03-30T17:00:00.000Z'),
        appointmentUrl: expect.stringContaining('/a/ABC1234'),
      }),
    );
  });

  it('does not send customer update SMS for manual dashboard edits', async () => {
    mockFindAppointment.mockResolvedValueOnce({
      ...baseAppointment,
      source: 'dashboard',
      status: 'confirmed',
      business: undefined,
    } as never);
    mockUpdateAppointment.mockResolvedValueOnce({
      ...baseAppointment,
      source: 'dashboard',
      status: 'confirmed',
      notes: 'Updated notes only',
      business: undefined,
    } as never);

    const response = await PATCH(
      new Request('https://www.clientific.app/api/mobile/appointments/appt-1', {
        method: 'PATCH',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ notes: 'Updated notes only' }),
      }),
      { params: Promise.resolve({ id: 'appt-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mockSendAppointmentRescheduled).not.toHaveBeenCalled();
    expect(mockSendAppointmentBusinessConfirmed).not.toHaveBeenCalled();
    expect(mockSendAppointmentCancellation).not.toHaveBeenCalled();
  });

  it('deletes the appointment and sends the cancellation SMS', async () => {
    mockFindAppointment.mockResolvedValueOnce({
      ...baseAppointment,
      business: {
        name: 'Clientific Studio',
        timezone: 'America/New_York',
        vapiPhoneNumber: '+18885550123',
      },
    } as never);
    mockDeleteAppointment.mockResolvedValue({ id: 'appt-1' } as never);

    const response = await DELETE(
      new Request('https://www.clientific.app/api/mobile/appointments/appt-1', {
        method: 'DELETE',
        headers: {
          authorization: 'Bearer token',
        },
      }),
      { params: Promise.resolve({ id: 'appt-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mockCancelScheduledAppointmentReminder).toHaveBeenCalled();
    expect(mockSendAppointmentCancellation).toHaveBeenCalledWith(
      '+15551234567',
      expect.objectContaining({
        customerName: 'Jordan Lee',
        serviceName: 'Haircut',
      }),
    );
    expect(mockDeleteAppointment).toHaveBeenCalledWith({ where: { id: 'appt-1' } });
  });
});
