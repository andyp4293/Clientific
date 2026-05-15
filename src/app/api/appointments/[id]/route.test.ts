import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('../../auth/[...nextauth]/route', () => ({
  authOptions: {},
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
    },
    service: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/subscription', () => ({
  requireActiveSubscription: vi.fn(),
}));

vi.mock('@/lib/segment', () => ({
  updateCustomerSegment: vi.fn(),
}));

vi.mock('@/lib/app-url', () => ({
  getConfiguredAppBaseUrl: vi.fn(() => 'https://www.clientific.app'),
}));

vi.mock('@/lib/moderation', () => ({
  blockedContentError: vi.fn((label: string) => `Blocked: ${label}`),
  getBlockedFieldLabel: vi.fn(() => null),
}));

vi.mock('@/lib/appointment-reminders', () => ({
  cancelScheduledAppointmentReminder: vi.fn().mockResolvedValue({ success: true, canceledCount: 1 }),
  scheduleAppointmentReminder: vi.fn().mockResolvedValue({ success: true, sid: 'SM_reminder' }),
}));

vi.mock('@/lib/appointment-short-id', () => ({
  ensureAppointmentShortId: vi.fn().mockResolvedValue('ABC1234'),
}));

vi.mock('@/lib/twilio', () => ({
  sendAppointmentBusinessConfirmed: vi.fn().mockResolvedValue({ success: true, sid: 'SM_confirmed' }),
  sendAppointmentCancellation: vi.fn().mockResolvedValue({ success: true, sid: 'SM_cancelled' }),
  sendAppointmentRescheduled: vi.fn().mockResolvedValue({ success: true, sid: 'SM_updated' }),
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription';
import {
  cancelScheduledAppointmentReminder,
  scheduleAppointmentReminder,
} from '@/lib/appointment-reminders';
import { ensureAppointmentShortId } from '@/lib/appointment-short-id';
import {
  sendAppointmentBusinessConfirmed,
  sendAppointmentCancellation,
  sendAppointmentRescheduled,
} from '@/lib/twilio';
import { DELETE, GET, PATCH } from './route';

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockRequireActiveSubscription = requireActiveSubscription as ReturnType<typeof vi.fn>;
const mockBusinessFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockAppointmentFindFirst = prisma.appointment.findFirst as ReturnType<typeof vi.fn>;
const mockAppointmentFindMany = prisma.appointment.findMany as ReturnType<typeof vi.fn>;
const mockAppointmentUpdate = prisma.appointment.update as ReturnType<typeof vi.fn>;
const mockServiceFindMany = prisma.service.findMany as ReturnType<typeof vi.fn>;
const mockCancelScheduledAppointmentReminder =
  cancelScheduledAppointmentReminder as ReturnType<typeof vi.fn>;
const mockScheduleAppointmentReminder =
  scheduleAppointmentReminder as ReturnType<typeof vi.fn>;
const mockEnsureAppointmentShortId = ensureAppointmentShortId as ReturnType<typeof vi.fn>;
const mockSendAppointmentBusinessConfirmed =
  sendAppointmentBusinessConfirmed as ReturnType<typeof vi.fn>;
const mockSendAppointmentCancellation =
  sendAppointmentCancellation as ReturnType<typeof vi.fn>;
const mockSendAppointmentRescheduled =
  sendAppointmentRescheduled as ReturnType<typeof vi.fn>;

function buildExistingAppointment(overrides: Record<string, any> = {}) {
  return {
    id: 'appt-1',
    shortId: 'ABC1234',
    customerId: 'cust-1',
    serviceId: 'svc-1',
    serviceIds: ['svc-1'],
    staffId: 'stf-1',
    startTime: new Date('2026-04-10T18:00:00.000Z'),
    endTime: new Date('2026-04-10T18:45:00.000Z'),
    duration: 45,
    status: 'pending',
    notes: null,
    customer: {
      name: 'Jane Doe',
      phone: '+15551234567',
      smsConsent: true,
      smsOptedOut: false,
    },
    service: { name: 'Gel Manicure' },
    staff: { fullName: 'Andy' },
    ...overrides,
  };
}

function buildUpdatedAppointment(overrides: Record<string, any> = {}) {
  return {
    id: 'appt-1',
    shortId: 'ABC1234',
    customerId: 'cust-1',
    serviceId: 'svc-1',
    serviceIds: ['svc-1'],
    staffId: 'stf-1',
    startTime: new Date('2026-04-10T18:00:00.000Z'),
    endTime: new Date('2026-04-10T18:45:00.000Z'),
    duration: 45,
    status: 'confirmed',
    notes: null,
    customer: {
      name: 'Jane Doe',
      phone: '+15551234567',
      smsConsent: true,
      smsOptedOut: false,
    },
    service: { name: 'Gel Manicure' },
    staff: { fullName: 'Andy' },
    ...overrides,
  };
}

describe('PATCH /api/appointments/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetServerSession.mockResolvedValue({
      user: {
        email: 'owner@clientific.app',
        businessId: 'biz-1',
      },
    });
    mockRequireActiveSubscription.mockResolvedValue(null);
    mockBusinessFindUnique.mockResolvedValue({
      id: 'biz-1',
      email: 'owner@clientific.app',
      name: 'Test Salon',
      timezone: 'America/New_York',
      vapiPhoneNumber: '+15557654321',
    });
    mockAppointmentFindFirst.mockResolvedValue(buildExistingAppointment());
    mockAppointmentFindMany.mockResolvedValue([]);
    mockAppointmentUpdate
      .mockResolvedValueOnce(buildUpdatedAppointment())
      .mockResolvedValueOnce({ id: 'appt-1', reminderSent: true });
    mockServiceFindMany.mockResolvedValue([{ id: 'svc-1', name: 'Gel Manicure' }]);
    mockEnsureAppointmentShortId.mockResolvedValue('ABC1234');
    mockCancelScheduledAppointmentReminder.mockResolvedValue({ success: true, canceledCount: 1 });
    mockScheduleAppointmentReminder.mockResolvedValue({ success: true, sid: 'SM_reminder' });
    mockSendAppointmentBusinessConfirmed.mockResolvedValue({
      success: true,
      sid: 'SM_confirmed',
    });
    mockSendAppointmentCancellation.mockResolvedValue({
      success: true,
      sid: 'SM_cancelled',
    });
    mockSendAppointmentRescheduled.mockResolvedValue({
      success: true,
      sid: 'SM_updated',
    });
  });

  it('blocks employee sessions from owner appointment detail, update, and delete APIs', async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        accountType: 'staff',
        email: 'employee@clientific.app',
        businessId: 'biz-1',
        staffId: 'staff-1',
      },
    });

    const getResponse = await GET(
      new NextRequest('http://localhost/api/appointments/appt-1'),
      { params: Promise.resolve({ id: 'appt-1' }) },
    );
    const patchResponse = await PATCH(
      new NextRequest('http://localhost/api/appointments/appt-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      }),
      { params: Promise.resolve({ id: 'appt-1' }) },
    );
    const deleteResponse = await DELETE(
      new NextRequest('http://localhost/api/appointments/appt-1', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: 'appt-1' }) },
    );

    expect(getResponse.status).toBe(403);
    expect(patchResponse.status).toBe(403);
    expect(deleteResponse.status).toBe(403);
    expect(mockBusinessFindUnique).not.toHaveBeenCalled();
    expect(mockAppointmentFindFirst).not.toHaveBeenCalled();
    expect(mockAppointmentUpdate).not.toHaveBeenCalled();
  });

  it('sends the confirmed SMS and schedules the 2-hour reminder when a pending appointment is confirmed', async () => {
    const request = new NextRequest('http://localhost/api/appointments/appt-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'appt-1' }) });

    expect(response.status).toBe(200);
    expect(mockSendAppointmentBusinessConfirmed).toHaveBeenCalledWith(
      '+15551234567',
      expect.objectContaining({
        customerName: 'Jane Doe',
        serviceName: 'Gel Manicure',
        businessName: 'Test Salon',
        appointmentUrl: expect.stringContaining('/a/ABC1234'),
      }),
    );
    expect(mockScheduleAppointmentReminder).toHaveBeenCalledWith(
      '+15551234567',
      expect.objectContaining({
        customerName: 'Jane Doe',
        serviceName: 'Gel Manicure',
        businessName: 'Test Salon',
        appointmentUrl: expect.stringContaining('/a/ABC1234'),
      }),
    );
    expect(mockAppointmentUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 'appt-1' },
      data: { reminderSent: true },
    });
  });

  it('does not send the confirmed SMS or reminder when the customer has opted out', async () => {
    mockAppointmentFindFirst.mockResolvedValue(
      buildExistingAppointment({
        customer: {
          name: 'Jane Doe',
          phone: '+15551234567',
          smsConsent: true,
          smsOptedOut: true,
        },
      }),
    );
    mockAppointmentUpdate.mockReset();
    mockAppointmentUpdate.mockResolvedValueOnce(
      buildUpdatedAppointment({
        customer: {
          name: 'Jane Doe',
          phone: '+15551234567',
          smsConsent: true,
          smsOptedOut: true,
        },
      }),
    );

    const request = new NextRequest('http://localhost/api/appointments/appt-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'appt-1' }) });

    expect(response.status).toBe(200);
    expect(mockSendAppointmentBusinessConfirmed).not.toHaveBeenCalled();
    expect(mockScheduleAppointmentReminder).not.toHaveBeenCalled();
  });

  it('still sends the business-confirmed SMS for an AI-requested appointment that already sent the initial request text', async () => {
    mockAppointmentFindFirst.mockResolvedValue(
      buildExistingAppointment({
        source: 'ai',
        confirmationSent: true,
      }),
    );
    mockAppointmentUpdate.mockReset();
    mockAppointmentUpdate
      .mockResolvedValueOnce(
        buildUpdatedAppointment({
          source: 'ai',
          confirmationSent: true,
        }),
      )
      .mockResolvedValueOnce({ id: 'appt-1', reminderSent: true });

    const request = new NextRequest('http://localhost/api/appointments/appt-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'appt-1' }) });

    expect(response.status).toBe(200);
    expect(mockSendAppointmentBusinessConfirmed).toHaveBeenCalledWith(
      '+15551234567',
      expect.objectContaining({
        customerName: 'Jane Doe',
        serviceName: 'Gel Manicure',
        businessName: 'Test Salon',
      }),
    );
    expect(mockScheduleAppointmentReminder).toHaveBeenCalledWith(
      '+15551234567',
      expect.objectContaining({
        customerName: 'Jane Doe',
        serviceName: 'Gel Manicure',
        businessName: 'Test Salon',
      }),
    );
  });

  it('sends an updated appointment SMS when an online booking changes service, staff, or time', async () => {
    mockAppointmentFindFirst.mockResolvedValue(
      buildExistingAppointment({
        source: 'online',
        status: 'confirmed',
        serviceId: 'svc-1',
        serviceIds: ['svc-1'],
        staffId: 'stf-1',
      }),
    );
    mockAppointmentUpdate.mockReset();
    mockAppointmentUpdate
      .mockResolvedValueOnce(
        buildUpdatedAppointment({
          source: 'online',
          status: 'confirmed',
          serviceId: 'svc-2',
          serviceIds: ['svc-2'],
          staffId: 'stf-2',
          startTime: new Date('2026-04-10T19:30:00.000Z'),
          duration: 60,
          service: { name: 'Pedicure' },
          staff: { fullName: 'Taylor' },
        }),
      )
      .mockResolvedValueOnce({ id: 'appt-1', reminderSent: true });
    mockServiceFindMany.mockResolvedValue([{ id: 'svc-2', name: 'Pedicure' }]);

    const request = new NextRequest('http://localhost/api/appointments/appt-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        startTime: '2026-04-10T19:30:00.000Z',
        duration: 60,
        serviceId: 'svc-2',
        serviceIds: ['svc-2'],
        staffId: 'stf-2',
      }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'appt-1' }) });

    expect(response.status).toBe(200);
    expect(mockSendAppointmentRescheduled).toHaveBeenCalledWith(
      '+15551234567',
      expect.objectContaining({
        customerName: 'Jane Doe',
        serviceName: 'Pedicure',
        staffName: 'Taylor',
        newDateTime: new Date('2026-04-10T19:30:00.000Z'),
        appointmentUrl: expect.stringContaining('/a/ABC1234'),
      }),
    );
  });

  it('does not text customers for notes-only manual dashboard appointment edits', async () => {
    mockAppointmentFindFirst.mockResolvedValue(
      buildExistingAppointment({
        source: 'dashboard',
        status: 'confirmed',
      }),
    );
    mockAppointmentUpdate.mockReset();
    mockAppointmentUpdate.mockResolvedValueOnce(
      buildUpdatedAppointment({
        source: 'dashboard',
        status: 'confirmed',
        notes: 'Prefers quiet corner',
      }),
    );

    const request = new NextRequest('http://localhost/api/appointments/appt-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ notes: 'Prefers quiet corner' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'appt-1' }) });

    expect(response.status).toBe(200);
    expect(mockSendAppointmentRescheduled).not.toHaveBeenCalled();
    expect(mockSendAppointmentBusinessConfirmed).not.toHaveBeenCalled();
    expect(mockSendAppointmentCancellation).not.toHaveBeenCalled();
  });
});
