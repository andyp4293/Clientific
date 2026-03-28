import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

vi.mock('@/lib/twilio', () => ({
  sendAppointmentCancellation: vi.fn(),
  sendAppointmentConfirmation: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    appointment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    staff: {
      findFirst: vi.fn(),
    },
  },
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import {
  sendAppointmentCancellation,
  sendAppointmentConfirmation,
} from '@/lib/twilio';
import { GET, PATCH } from './route';

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockAppointmentFindUnique = prisma.appointment.findUnique as ReturnType<typeof vi.fn>;
const mockAppointmentFindFirst = prisma.appointment.findFirst as ReturnType<typeof vi.fn>;
const mockAppointmentUpdate = prisma.appointment.update as ReturnType<typeof vi.fn>;
const mockServiceFindMany = prisma.service.findMany as ReturnType<typeof vi.fn>;
const mockNotificationCreate = prisma.notification.create as ReturnType<typeof vi.fn>;
const mockStaffFindFirst = prisma.staff.findFirst as ReturnType<typeof vi.fn>;
const mockSendAppointmentCancellation = sendAppointmentCancellation as ReturnType<typeof vi.fn>;
const mockSendAppointmentConfirmation = sendAppointmentConfirmation as ReturnType<typeof vi.fn>;

const allDayHours = Object.fromEntries(
  Array.from({ length: 7 }, (_, day) => [
    day.toString(),
    { isOpen: true, openTime: '09:00', closeTime: '17:00' },
  ])
);

function buildPatchAppointment(overrides: Record<string, any> = {}) {
  return {
    status: 'confirmed',
    startTime: new Date('2026-03-22T15:00:00.000Z'),
    shortId: 'ABC1234',
    serviceId: 'svc-1',
    serviceIds: ['svc-1', 'svc-2'],
    staffId: 'stf-1',
    staff: { fullName: 'Andy' },
    service: { name: 'Gel Manicure' },
    customer: {
      name: 'Jane Doe',
      phone: '+15551234567',
      smsConsent: true,
      smsOptedOut: false,
    },
    business: {
      name: 'Test Salon',
      timezone: 'America/New_York',
      vapiPhoneNumber: '+15557654321',
      businessHours: { hours: allDayHours },
      closureDates: [],
    },
    businessId: 'biz-1',
    duration: 90,
    ...overrides,
  };
}

describe('/api/public/appointment/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockGetServerSession.mockResolvedValue(null);
    mockSendAppointmentCancellation.mockResolvedValue({ success: true });
    mockSendAppointmentConfirmation.mockResolvedValue({ success: true });
    mockAppointmentFindFirst.mockResolvedValue(null);
    mockAppointmentUpdate.mockResolvedValue({
      id: 'appt-1',
      status: 'pending',
      startTime: '2026-03-23T15:00:00.000Z',
      endTime: '2026-03-23T16:30:00.000Z',
    });
    mockNotificationCreate.mockResolvedValue({ id: 'notif-1' });
    mockStaffFindFirst.mockResolvedValue({
      id: 'stf-1',
      fullName: 'Andy',
      workDays: [0, 1, 2, 3, 4, 5, 6],
      workHours: null,
      serviceAssignments: [],
    });
    mockAppointmentFindUnique.mockResolvedValue({
      id: 'appt-1',
      status: 'confirmed',
      startTime: '2026-03-22T15:00:00.000Z',
      endTime: '2026-03-22T16:30:00.000Z',
      duration: 90,
      notes: null,
      serviceIds: ['svc-1'],
      staffId: null,
      service: null,
      staff: null,
      business: {
        id: 'biz-1',
        name: 'Test Salon',
        phone: '+15551234567',
        timezone: 'America/New_York',
        slug: 'test-salon',
        publicId: 'pub-1',
      },
    });
    mockServiceFindMany.mockResolvedValue([{ name: 'Haircut', price: 45 }]);
  });

  it('keeps viewerCanManage false for public visitors and does not expose the internal business id', async () => {
    const req = new NextRequest('http://localhost/api/public/appointment/appt-1');
    const res = await GET(req, { params: Promise.resolve({ id: 'appt-1' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.viewerCanManage).toBe(false);
    expect(body.appointment.business.id).toBeUndefined();
  });

  it('marks viewerCanManage true for the owning business session', async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: 'user-1',
        businessId: 'biz-1',
      },
    });

    const req = new NextRequest('http://localhost/api/public/appointment/appt-1');
    const res = await GET(req, { params: Promise.resolve({ id: 'appt-1' }) });

    const body = await res.json();
    expect(body.viewerCanManage).toBe(true);
    expect(body.appointment.business.name).toBe('Test Salon');
  });

  it('reschedules a specific-staff appointment back to pending and resets notification flags', async () => {
    mockAppointmentFindUnique.mockResolvedValue(buildPatchAppointment());
    mockServiceFindMany.mockResolvedValue([
      { id: 'svc-1', name: 'Gel Manicure' },
      { id: 'svc-2', name: 'Nail Art' },
    ]);

    const req = new NextRequest('http://localhost/api/public/appointment/appt-1', {
      method: 'PATCH',
      body: JSON.stringify({ startTime: '2026-03-23T15:00:00.000Z' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: 'appt-1' }) });
    expect(res.status).toBe(200);

    expect(mockAppointmentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'biz-1',
          staffId: 'stf-1',
          status: { in: ['pending', 'scheduled', 'confirmed'] },
        }),
      })
    );
    expect(mockAppointmentUpdate).toHaveBeenCalledWith({
      where: { id: 'appt-1' },
      data: expect.objectContaining({
        status: 'pending',
        confirmationSent: false,
        reminderSent: false,
      }),
    });
    expect(mockSendAppointmentConfirmation).toHaveBeenCalledWith(
      '+15551234567',
      expect.objectContaining({
        customerName: 'Jane Doe',
        serviceName: 'Gel Manicure, Nail Art',
        staffName: 'Andy',
        appointmentUrl: expect.stringContaining('/a/ABC1234'),
      })
    );
    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'biz-1',
          title: 'Appointment Reschedule Request',
        }),
      })
    );
  });

  it('does not run specific-staff conflict checks when the appointment is for anyone available', async () => {
    mockAppointmentFindUnique.mockResolvedValue(
      buildPatchAppointment({
        staffId: null,
        staff: null,
      })
    );
    mockServiceFindMany.mockResolvedValue([{ id: 'svc-1', name: 'Gel Manicure' }]);

    const req = new NextRequest('http://localhost/api/public/appointment/appt-1', {
      method: 'PATCH',
      body: JSON.stringify({ startTime: '2026-03-23T15:00:00.000Z' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: 'appt-1' }) });
    expect(res.status).toBe(200);
    expect(mockAppointmentFindFirst).not.toHaveBeenCalled();
    expect(mockStaffFindFirst).not.toHaveBeenCalled();
  });

  it('rejects reschedules that fall outside business hours', async () => {
    mockAppointmentFindUnique.mockResolvedValue(
      buildPatchAppointment({
        business: {
          name: 'Test Salon',
          timezone: 'America/New_York',
          vapiPhoneNumber: '+15557654321',
          businessHours: { hours: allDayHours },
          closureDates: [{ date: '2026-03-23', label: 'Spring Holiday' }],
        },
      })
    );

    const req = new NextRequest('http://localhost/api/public/appointment/appt-1', {
      method: 'PATCH',
      body: JSON.stringify({ startTime: '2026-03-23T15:00:00.000Z' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: 'appt-1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Spring Holiday');
    expect(mockAppointmentUpdate).not.toHaveBeenCalled();
  });
});
