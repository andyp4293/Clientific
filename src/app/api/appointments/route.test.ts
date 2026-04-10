import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    customer: { findFirst: vi.fn(), update: vi.fn() },
    staff: { findFirst: vi.fn() },
    appointment: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    service: { findMany: vi.fn() },
    notification: { create: vi.fn() },
    smsConsentEvent: { create: vi.fn() },
  },
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {},
  PRICING_PLANS: {
    STARTER: { name: 'Starter', limits: { customers: 100, staff: 10, services: 10 } },
    PRO: { name: 'Pro', limits: { customers: 1000, staff: 50, services: 50 } },
    PREMIUM: { name: 'Premium', limits: { customers: Infinity, staff: Infinity, services: Infinity } },
  },
}));

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
vi.mock('@/lib/twilio', () => ({ sendAppointmentConfirmation: vi.fn().mockResolvedValue({ success: true }) }));
vi.mock('@/lib/appointment-reminders', () => ({
  scheduleAppointmentReminder: vi.fn().mockResolvedValue({ success: true, sid: 'SM_reminder' }),
}));
vi.mock('@/lib/appointment-short-id', () => ({
  ensureAppointmentShortId: vi.fn().mockResolvedValue('ABC1234'),
}));
vi.mock('@/lib/email', () => ({ sendNewBookingEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/mobile-push', () => ({
  createBusinessNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/timezone', () => ({
  businessDayStart: vi.fn((date: string) => new Date(date)),
  weekdayIndexInTimeZone: vi.fn((date: Date) => date.getUTCDay()),
  dateKeyInTimeZone: vi.fn((date: Date) => date.toISOString().slice(0, 10)),
  localToUTC: vi.fn((dateStr: string, hour: number, minute: number) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  }),
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { sendAppointmentConfirmation } from '@/lib/twilio';
import { scheduleAppointmentReminder } from '@/lib/appointment-reminders';
import { ensureAppointmentShortId } from '@/lib/appointment-short-id';
import { GET, POST } from './route';

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockCustomerFindFirst = prisma.customer.findFirst as ReturnType<typeof vi.fn>;
const mockCustomerUpdate = prisma.customer.update as ReturnType<typeof vi.fn>;
const mockStaffFindFirst = prisma.staff.findFirst as ReturnType<typeof vi.fn>;
const mockAppointmentFindMany = prisma.appointment.findMany as ReturnType<typeof vi.fn>;
const mockAppointmentCreate = prisma.appointment.create as ReturnType<typeof vi.fn>;
const mockAppointmentUpdate = prisma.appointment.update as ReturnType<typeof vi.fn>;
const mockServiceFindMany = prisma.service.findMany as ReturnType<typeof vi.fn>;
const mockNotificationCreate = prisma.notification.create as ReturnType<typeof vi.fn>;
const mockSmsConsentEventCreate = prisma.smsConsentEvent.create as ReturnType<typeof vi.fn>;
const mockScheduleAppointmentReminder = scheduleAppointmentReminder as ReturnType<typeof vi.fn>;
const mockEnsureAppointmentShortId = ensureAppointmentShortId as ReturnType<typeof vi.fn>;

// Appointments use session.user.email for business lookup, session.user.businessId for subscription
const activeSession = { user: { businessId: 'biz-1', email: 'owner@test.com' } };
const fakeBusiness = {
  id: 'biz-1',
  email: 'owner@test.com',
  name: 'Test Salon',
  timezone: 'America/New_York',
  notifyNewBookingEmail: false,
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
  subscriptionStatus: 'active',
  trialEndsAt: null,
};

const validApptBody = {
  customerId: 'cust-1',
  startTime: '2026-03-10T14:00:00.000Z',
  duration: 60,
};

function makeRequest(body: Record<string, unknown> = validApptBody) {
  return new NextRequest('http://localhost/api/appointments', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(sendAppointmentConfirmation).mockResolvedValue({ success: true } as any);
  mockCustomerFindFirst.mockResolvedValue({
    id: 'cust-1',
    phone: '+15551234567',
  });
  mockCustomerUpdate.mockResolvedValue({
    id: 'cust-1',
    smsConsent: true,
    smsOptedOut: false,
  });
  mockSmsConsentEventCreate.mockResolvedValue({ id: 'evt-1' });
  mockStaffFindFirst.mockResolvedValue({
    id: 'staff-1',
    fullName: 'Andy',
    workDays: [0, 1, 2, 3, 4, 5, 6],
    workHours: null,
    serviceAssignments: [],
  });
  mockAppointmentUpdate.mockResolvedValue({ id: 'appt-1', reminderSent: true });
  mockScheduleAppointmentReminder.mockResolvedValue({ success: true, sid: 'SM_reminder' });
  mockEnsureAppointmentShortId.mockResolvedValue('ABC1234');
});

describe('GET /api/appointments', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/api/appointments'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when business not found', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/api/appointments'));
    expect(res.status).toBe(404);
  });

  it('returns appointments for authenticated business', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValue(fakeBusiness);
    mockAppointmentFindMany.mockResolvedValue([{ id: 'appt-1', customerId: 'cust-1' }]);
    const res = await GET(new NextRequest('http://localhost/api/appointments'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.appointments).toHaveLength(1);
    expect(body.timezone).toBe('America/New_York');
  });

  it('returns a combined serviceDisplayName for multi-service appointments', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValue(fakeBusiness);
    mockAppointmentFindMany.mockResolvedValue([
      {
        id: 'appt-1',
        customerId: 'cust-1',
        serviceIds: ['svc-gel', 'svc-pedi'],
        service: { id: 'svc-gel', name: 'Gel Manicure' },
      },
    ]);
    mockServiceFindMany.mockResolvedValue([
      { id: 'svc-gel', name: 'Gel Manicure' },
      { id: 'svc-pedi', name: 'Gel Pedicure' },
    ]);

    const res = await GET(new NextRequest('http://localhost/api/appointments'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.appointments[0].serviceDisplayName).toBe('Gel Manicure, Gel Pedicure');
    expect(body.appointments[0].services).toEqual([
      { id: 'svc-gel', name: 'Gel Manicure' },
      { id: 'svc-pedi', name: 'Gel Pedicure' },
    ]);
  });
});

describe('POST /api/appointments', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 SUBSCRIPTION_REQUIRED when trial expired', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({
      subscriptionStatus: 'trialing',
      trialEndsAt: new Date(Date.now() - 86400000),
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('returns 400 when required fields are missing', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce(fakeBusiness);
    const res = await POST(makeRequest({ customerId: 'cust-1' })); // missing startTime + duration
    expect(res.status).toBe(400);
  });

  it('returns 409 when staff has a conflicting appointment', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce(fakeBusiness);
    // Return a conflicting appointment
    mockAppointmentFindMany.mockResolvedValue([{ id: 'existing-appt' }]);
    const res = await POST(
      makeRequest({ ...validApptBody, staffId: 'staff-1' })
    );
    expect(res.status).toBe(409);
  });

  it('blocks dashboard bookings outside the selected staff member’s hours', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        ...fakeBusiness,
        businessHours: {
          hours: {
            2: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          },
        },
      });
    mockStaffFindFirst.mockResolvedValue({
      id: 'staff-1',
      fullName: 'Andy',
      workDays: [2],
      workHours: {
        2: { startTime: '10:00', endTime: '16:00' },
      },
      serviceAssignments: [],
    });

    const res = await POST(
      makeRequest({
        customerId: 'cust-1',
        staffId: 'staff-1',
        startTime: '2026-03-10T09:00:00.000Z',
        duration: 60,
      })
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining('Andy is available Tuesday from 10:00 AM to 4:00 PM.'),
    });
    expect(mockAppointmentFindMany).not.toHaveBeenCalled();
  });

  it('blocks dashboard bookings on a specific closed date', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        ...fakeBusiness,
        closureDates: [{ date: '2026-03-10', label: 'Training Day' }],
      });

    const res = await POST(
      makeRequest({
        customerId: 'cust-1',
        startTime: '2026-03-10T14:00:00.000Z',
        duration: 60,
      })
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: 'Business is closed for Training Day.',
    });
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });

  it('creates appointment successfully with no conflicts', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce(fakeBusiness);
    mockAppointmentFindMany.mockResolvedValue([]); // no conflicts
    mockNotificationCreate.mockResolvedValue({});
    const fakeAppt = {
      id: 'appt-1',
      customerId: 'cust-1',
      businessId: 'biz-1',
      startTime: new Date(validApptBody.startTime),
      duration: 60,
      customer: { id: 'cust-1', name: 'Test', phone: null, email: null, smsConsent: false },
      service: null,
      staff: null,
      business: { name: 'Test Salon' },
    };
    mockAppointmentCreate.mockResolvedValue(fakeAppt);
    const res = await POST(makeRequest({ ...validApptBody, staffId: 'staff-1' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.appointment.id).toBe('appt-1');
  });

  it('creates appointment without staffId (no conflict check)', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce(fakeBusiness);
    mockNotificationCreate.mockResolvedValue({});
    const fakeAppt = {
      id: 'appt-2',
      customerId: 'cust-1',
      startTime: new Date(validApptBody.startTime),
      duration: 60,
      customer: { id: 'cust-1', name: 'Test', phone: null, email: null, smsConsent: false },
      service: null,
      staff: null,
      business: { name: 'Test Salon' },
    };
    mockAppointmentCreate.mockResolvedValue(fakeAppt);
    const res = await POST(makeRequest(validApptBody)); // no staffId
    expect(res.status).toBe(201);
    // No conflict check without staffId
    expect(mockAppointmentFindMany).not.toHaveBeenCalled();
  });

  it('uses business AI number as SMS sender when available', async () => {
    vi.mocked(sendAppointmentConfirmation).mockResolvedValue({ success: true } as any);
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({ ...fakeBusiness, vapiPhoneNumber: '+18557654989' });
    mockAppointmentFindMany.mockResolvedValue([]);
    mockNotificationCreate.mockResolvedValue({});
    mockAppointmentCreate.mockResolvedValue({
      id: 'appt-3',
      customerId: 'cust-1',
      businessId: 'biz-1',
      shortId: null,
      startTime: new Date(validApptBody.startTime),
      duration: 60,
      customer: {
        id: 'cust-1',
        name: 'Test',
        phone: '+15551234567',
        email: null,
        smsConsent: true,
        smsOptedOut: false,
      },
      service: { name: 'Haircut' },
      staff: null,
      business: { name: 'Test Salon' },
    });

    const res = await POST(makeRequest(validApptBody));

    expect(res.status).toBe(201);
    expect(sendAppointmentConfirmation).toHaveBeenCalledWith(
      '+15551234567',
      expect.objectContaining({
        businessName: 'Test Salon',
        appointmentUrl: expect.stringContaining('/a/ABC1234'),
        senderPhone: '+18557654989',
      })
    );
    expect(scheduleAppointmentReminder).toHaveBeenCalledWith(
      '+15551234567',
      expect.objectContaining({
        businessName: 'Test Salon',
        appointmentUrl: expect.stringContaining('/a/ABC1234'),
      }),
    );
    expect(mockAppointmentUpdate).toHaveBeenCalledWith({
      where: { id: 'appt-3' },
      data: { reminderSent: true },
    });
  });

  it('does not send or schedule SMS when the customer has not consented', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce(fakeBusiness);
    mockAppointmentFindMany.mockResolvedValue([]);
    mockNotificationCreate.mockResolvedValue({});
    mockAppointmentCreate.mockResolvedValue({
      id: 'appt-4',
      customerId: 'cust-1',
      businessId: 'biz-1',
      shortId: null,
      startTime: new Date(validApptBody.startTime),
      duration: 60,
      customer: {
        id: 'cust-1',
        name: 'Test',
        phone: '+15551234567',
        email: null,
        smsConsent: false,
        smsOptedOut: false,
      },
      service: { name: 'Haircut' },
      staff: null,
      business: { name: 'Test Salon' },
    });

    const res = await POST(makeRequest(validApptBody));

    expect(res.status).toBe(201);
    expect(sendAppointmentConfirmation).not.toHaveBeenCalled();
    expect(scheduleAppointmentReminder).not.toHaveBeenCalled();
    expect(mockEnsureAppointmentShortId).not.toHaveBeenCalled();
  });

  it('captures manual appointment SMS consent, logs it, and sends the request text', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce(fakeBusiness);
    mockAppointmentFindMany.mockResolvedValue([]);
    mockNotificationCreate.mockResolvedValue({});
    mockAppointmentCreate.mockResolvedValue({
      id: 'appt-5',
      customerId: 'cust-1',
      businessId: 'biz-1',
      shortId: null,
      startTime: new Date(validApptBody.startTime),
      duration: 60,
      customer: {
        id: 'cust-1',
        name: 'Bob',
        phone: '+15551234567',
        email: null,
        smsConsent: false,
        smsOptedOut: true,
      },
      service: { name: 'Haircut' },
      staff: { fullName: 'Andy' },
      business: { name: 'Test Salon' },
    });

    const res = await POST(
      makeRequest({
        ...validApptBody,
        appointmentSmsConsent: true,
      })
    );

    expect(res.status).toBe(201);
    expect(mockCustomerFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'cust-1',
        businessId: 'biz-1',
      },
      select: {
        id: true,
        phone: true,
      },
    });
    expect(mockCustomerUpdate).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      data: {
        smsConsent: true,
        smsOptedOut: false,
        smsOptedOutAt: null,
      },
    });
    expect(mockSmsConsentEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: 'biz-1',
        customerId: 'cust-1',
        phone: '+15551234567',
        eventType: 'MANUAL_APPOINTMENT_OPT_IN',
        source: 'dashboard_appointment',
        metadata: expect.objectContaining({
          consentType: 'transactional',
          consentMethod: 'verbal',
          channel: 'dashboard-appointments',
          appointmentId: 'appt-5',
        }),
      }),
    });
    expect(sendAppointmentConfirmation).toHaveBeenCalledWith(
      '+15551234567',
      expect.objectContaining({
        customerName: 'Bob',
        businessName: 'Test Salon',
        appointmentUrl: expect.stringContaining('/a/ABC1234'),
      })
    );
    expect(scheduleAppointmentReminder).toHaveBeenCalledWith(
      '+15551234567',
      expect.objectContaining({
        customerName: 'Bob',
        businessName: 'Test Salon',
        appointmentUrl: expect.stringContaining('/a/ABC1234'),
      })
    );
  });

  it('blocks manual appointment SMS consent when the customer has no phone number', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce(fakeBusiness);
    mockAppointmentFindMany.mockResolvedValue([]);
    mockCustomerFindFirst.mockResolvedValue({
      id: 'cust-1',
      phone: null,
    });

    const res = await POST(
      makeRequest({
        ...validApptBody,
        appointmentSmsConsent: true,
      })
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: 'Customer needs a phone number before appointment texts can be enabled',
    });
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
    expect(mockCustomerUpdate).not.toHaveBeenCalled();
    expect(sendAppointmentConfirmation).not.toHaveBeenCalled();
  });
});
