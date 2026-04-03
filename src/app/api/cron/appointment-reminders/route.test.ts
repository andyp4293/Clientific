import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    appointment: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/appointment-reminders', () => ({
  scheduleAppointmentReminder: vi.fn(),
}));

vi.mock('@/lib/appointment-short-id', () => ({
  ensureAppointmentShortId: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { scheduleAppointmentReminder } from '@/lib/appointment-reminders';
import { ensureAppointmentShortId } from '@/lib/appointment-short-id';
import { GET } from './route';

const mockAppointmentFindMany = prisma.appointment.findMany as ReturnType<typeof vi.fn>;
const mockAppointmentUpdate = prisma.appointment.update as ReturnType<typeof vi.fn>;
const mockServiceFindMany = prisma.service.findMany as ReturnType<typeof vi.fn>;
const mockScheduleAppointmentReminder = scheduleAppointmentReminder as ReturnType<typeof vi.fn>;
const mockEnsureAppointmentShortId = ensureAppointmentShortId as ReturnType<typeof vi.fn>;

describe('GET /api/cron/appointment-reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'cron-secret';
    mockAppointmentFindMany.mockResolvedValue([]);
    mockAppointmentUpdate.mockResolvedValue({ id: 'appt-1', reminderSent: true });
    mockServiceFindMany.mockResolvedValue([{ id: 'svc-1', name: 'Gel Manicure' }]);
    mockScheduleAppointmentReminder.mockResolvedValue({ success: true, sid: 'SM123' });
    mockEnsureAppointmentShortId.mockResolvedValue('ABC1234');
  });

  it('requires the cron bearer token', async () => {
    const req = new NextRequest('http://localhost/api/cron/appointment-reminders');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('schedules reminders for eligible appointments and marks them as scheduled', async () => {
    mockAppointmentFindMany.mockResolvedValue([
      {
        id: 'appt-1',
        shortId: null,
        serviceIds: ['svc-1'],
        startTime: new Date('2026-04-15T18:00:00.000Z'),
        status: 'confirmed',
        customer: {
          name: 'Jordan',
          phone: '+19087272437',
        },
        service: { name: 'Gel Manicure' },
        staff: { fullName: 'Andy' },
        business: {
          name: 'Davi Nails',
          timezone: 'America/New_York',
          vapiPhoneNumber: '+18557654989',
        },
      },
    ]);

    const req = new NextRequest('http://localhost/api/cron/appointment-reminders', {
      headers: {
        authorization: 'Bearer cron-secret',
      },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockEnsureAppointmentShortId).toHaveBeenCalledWith('appt-1', null);
    expect(mockScheduleAppointmentReminder).toHaveBeenCalledWith(
      '+19087272437',
      expect.objectContaining({
        businessName: 'Davi Nails',
        appointmentUrl: expect.stringContaining('/a/ABC1234'),
      }),
      expect.any(Date),
    );
    expect(mockAppointmentUpdate).toHaveBeenCalledWith({
      where: { id: 'appt-1' },
      data: { reminderSent: true },
    });
  });

  it('counts scheduling-window misses as skipped without mutating the appointment', async () => {
    mockAppointmentFindMany.mockResolvedValue([
      {
        id: 'appt-2',
        shortId: 'ABC1234',
        serviceIds: ['svc-1'],
        startTime: new Date('2026-04-15T18:00:00.000Z'),
        status: 'scheduled',
        customer: {
          name: 'Jordan',
          phone: '+19087272437',
        },
        service: { name: 'Gel Manicure' },
        staff: { fullName: 'Andy' },
        business: {
          name: 'Davi Nails',
          timezone: 'America/New_York',
          vapiPhoneNumber: '+18557654989',
        },
      },
    ]);
    mockScheduleAppointmentReminder.mockResolvedValue({
      success: false,
      error: 'Appointment is outside the reminder scheduling window',
    });

    const req = new NextRequest('http://localhost/api/cron/appointment-reminders', {
      headers: {
        authorization: 'Bearer cron-secret',
      },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.skippedCount).toBe(1);
    expect(mockAppointmentUpdate).not.toHaveBeenCalled();
  });
});
