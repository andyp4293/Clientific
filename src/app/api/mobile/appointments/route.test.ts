import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-session', () => ({
  getBearerToken: vi.fn(),
  verifyMobileSessionToken: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    staff: { findFirst: vi.fn() },
    appointment: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    service: { findMany: vi.fn(), findFirst: vi.fn() },
    customer: { findFirst: vi.fn(), update: vi.fn() },
    smsConsentEvent: { create: vi.fn() },
  },
}));

vi.mock('@/lib/onboarding', () => ({
  isBusinessOnboardingComplete: vi.fn(() => true),
}));

vi.mock('@/lib/twilio', () => ({
  sendAppointmentConfirmation: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/subscription', () => ({
  requireActiveSubscription: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/app-url', () => ({
  getConfiguredAppBaseUrl: vi.fn(() => 'https://www.clientific.app'),
}));

vi.mock('@/lib/business-hours-validation', () => ({
  validateBusinessHoursForAppointment: vi.fn(() => null),
}));

vi.mock('@/lib/moderation', () => ({
  blockedContentError: vi.fn(() => 'Blocked content'),
  getBlockedFieldLabel: vi.fn(() => null),
}));

vi.mock('@/lib/staff-service-validation', () => ({
  validateBookableStaffSelection: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/appointment-services', () => ({
  collectAppointmentServiceIds: vi.fn(() => ['svc-1']),
  withAppointmentServiceDisplay: vi.fn((appointments: unknown[]) => appointments),
}));

vi.mock('@/lib/appointment-reminders', () => ({
  scheduleAppointmentReminder: vi.fn().mockResolvedValue({ success: true, sid: 'SM_reminder' }),
}));

vi.mock('@/lib/appointment-short-id', () => ({
  ensureAppointmentShortId: vi.fn().mockResolvedValue('ABC1234'),
}));

vi.mock('@/lib/mobile-push', () => ({
  createBusinessNotification: vi.fn().mockResolvedValue({ id: 'notif-1' }),
}));

import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { prisma } from '@/lib/prisma';
import { sendAppointmentConfirmation } from '@/lib/twilio';
import { requireActiveSubscription } from '@/lib/subscription';
import { validateBusinessHoursForAppointment } from '@/lib/business-hours-validation';
import { getBlockedFieldLabel } from '@/lib/moderation';
import { validateBookableStaffSelection } from '@/lib/staff-service-validation';
import { scheduleAppointmentReminder } from '@/lib/appointment-reminders';
import { ensureAppointmentShortId } from '@/lib/appointment-short-id';
import { createBusinessNotification } from '@/lib/mobile-push';
import { GET, POST } from './route';

const mockGetBearerToken = vi.mocked(getBearerToken);
const mockVerifyMobileSessionToken = vi.mocked(verifyMobileSessionToken);
const mockFindBusiness = vi.mocked(prisma.business.findUnique);
const mockFindStaff = vi.mocked(prisma.staff.findFirst);
const mockFindAppointments = vi.mocked(prisma.appointment.findMany);
const mockCreateAppointment = vi.mocked(prisma.appointment.create);
const mockUpdateAppointment = vi.mocked(prisma.appointment.update);
const mockFindServices = vi.mocked(prisma.service.findMany);
const mockFindService = vi.mocked(prisma.service.findFirst);
const mockFindCustomer = vi.mocked(prisma.customer.findFirst);
const mockUpdateCustomer = vi.mocked(prisma.customer.update);
const mockCreateConsentEvent = vi.mocked(prisma.smsConsentEvent.create);
const mockRequireActiveSubscription = vi.mocked(requireActiveSubscription);
const mockValidateBusinessHours = vi.mocked(validateBusinessHoursForAppointment);
const mockGetBlockedFieldLabel = vi.mocked(getBlockedFieldLabel);
const mockValidateBookableStaffSelection = vi.mocked(validateBookableStaffSelection);
const mockSendAppointmentConfirmation = vi.mocked(sendAppointmentConfirmation);
const mockScheduleAppointmentReminder = vi.mocked(scheduleAppointmentReminder);
const mockEnsureAppointmentShortId = vi.mocked(ensureAppointmentShortId);
const mockCreateBusinessNotification = vi.mocked(createBusinessNotification);

const business = {
  id: 'biz-1',
  email: 'owner@clientific.app',
  name: 'Clientific Studio',
  businessType: 'Salon',
  phone: '+15551234567',
  street: '123 Main St',
  city: 'Austin',
  state: 'TX',
  zipCode: '78701',
  country: 'United States',
  timezone: 'America/New_York',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBearerToken.mockReturnValue('token');
  mockVerifyMobileSessionToken.mockResolvedValue({
    businessId: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    onboardingComplete: true,
    accountType: 'owner',
    staffId: null,
    staffName: null,
  });
  mockRequireActiveSubscription.mockResolvedValue(null);
  mockValidateBusinessHours.mockReturnValue(null);
  mockGetBlockedFieldLabel.mockReturnValue(null);
  mockValidateBookableStaffSelection.mockResolvedValue(null);
  mockFindBusiness.mockResolvedValue({
    ...business,
    vapiPhoneNumber: '+18885550123',
    businessHours: { hours: {} },
    closureDates: [],
  } as never);
  mockFindStaff.mockResolvedValue({ id: 'staff-1', fullName: 'Taylor' } as never);
  mockFindAppointments.mockResolvedValue([]);
  mockFindServices.mockResolvedValue([{ id: 'svc-1', name: 'Haircut', duration: 45 }] as never);
  mockFindService.mockResolvedValue({
    id: 'svc-1',
    name: 'Haircut',
    duration: 45,
  } as never);
  mockFindCustomer.mockResolvedValue({
    id: 'cust-1',
    phone: '+15551234567',
    smsConsent: false,
    smsOptedOut: false,
  } as never);
  mockUpdateCustomer.mockResolvedValue({
    id: 'cust-1',
    smsConsent: true,
    smsOptedOut: false,
  } as never);
  mockCreateConsentEvent.mockResolvedValue({ id: 'evt-1' } as never);
  mockCreateAppointment.mockResolvedValue({
    id: 'appt-2',
    customerId: 'cust-1',
    duration: 60,
    notes: 'Please text me',
    status: 'scheduled',
    source: 'dashboard',
    shortId: null,
    startTime: new Date('2026-03-30T15:00:00.000Z'),
    endTime: new Date('2026-03-30T16:00:00.000Z'),
    customer: {
      id: 'cust-1',
      name: 'Jordan Lee',
      phone: '+15551234567',
      smsConsent: false,
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
  } as never);
  mockUpdateAppointment.mockResolvedValue({ id: 'appt-2', reminderSent: true } as never);
  mockSendAppointmentConfirmation.mockResolvedValue({ success: true } as never);
  mockScheduleAppointmentReminder.mockResolvedValue({ success: true, sid: 'SM_123' } as never);
  mockEnsureAppointmentShortId.mockResolvedValue('ABC1234');
});

describe('mobile appointments route', () => {
  it('returns a formatted daily appointment summary', async () => {
    mockFindAppointments.mockResolvedValueOnce([
      {
        id: 'appt-1',
        startTime: new Date('2026-03-30T14:00:00.000Z'),
        endTime: new Date('2026-03-30T15:00:00.000Z'),
        duration: 60,
        status: 'confirmed',
        source: 'dashboard',
        notes: 'Color touch-up',
        serviceDisplayName: 'Color',
        customer: {
          id: 'cust-1',
          name: 'Jordan Lee',
        },
        service: {
          id: 'svc-1',
          name: 'Color',
        },
        staff: {
          id: 'staff-1',
          fullName: 'Taylor',
        },
      },
    ] as never);

    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/appointments?date=2026-03-30', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.selectedDate).toBe('2026-03-30');
    expect(body.counts.total).toBe(1);
    expect(body.counts.confirmed).toBe(1);
    expect(body.appointments[0]).toEqual(
      expect.objectContaining({
        customerName: 'Jordan Lee',
        serviceName: 'Color',
        statusLabel: 'Confirmed',
        sourceLabel: 'Manual',
        canConfirm: false,
        canModify: true,
      }),
    );
  });

  it('limits staff sessions to assigned appointments and hides owner actions', async () => {
    mockVerifyMobileSessionToken.mockResolvedValueOnce({
      businessId: 'biz-1',
      accountType: 'staff',
      staffId: 'staff-1',
      staffName: 'Taylor',
      email: 'taylor@example.com',
      name: 'Taylor',
      onboardingComplete: true,
    });
    mockFindBusiness.mockResolvedValueOnce(business as never);
    mockFindAppointments.mockResolvedValueOnce([
      {
        id: 'appt-1',
        startTime: new Date('2026-03-30T14:00:00.000Z'),
        endTime: new Date('2026-03-30T15:00:00.000Z'),
        duration: 60,
        status: 'pending',
        source: 'dashboard',
        notes: 'No phone is selected in this response',
        customer: {
          id: 'cust-1',
          name: 'Jordan Lee',
        },
        service: {
          id: 'svc-1',
          name: 'Color',
        },
        staff: {
          id: 'staff-1',
          fullName: 'Taylor',
        },
      },
    ] as never);

    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/appointments?date=2026-03-30', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockFindAppointments).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ businessId: 'biz-1', staffId: 'staff-1' }),
      }),
    );

    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain('+15551234567');
    expect(body.viewer).toEqual(
      expect.objectContaining({
        role: 'staff',
        staffId: 'staff-1',
        privacy: 'customer_phone_hidden',
      }),
    );
    expect(body.appointments[0]).toEqual(
      expect.objectContaining({
        canConfirm: false,
        canModify: false,
      }),
    );
  });

  it('creates a mobile appointment, captures appointment SMS consent, and schedules the reminder', async () => {
    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/appointments', {
        method: 'POST',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          customerId: 'cust-1',
          serviceId: 'svc-1',
          staffId: 'staff-1',
          startTime: '2026-03-30T15:00:00.000Z',
          duration: 999,
          notes: 'Please text me',
          appointmentSmsConsent: true,
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mockFindServices).toHaveBeenCalledWith({
      where: {
        id: { in: ['svc-1'] },
        businessId: 'biz-1',
        active: true,
      },
      select: {
        id: true,
        name: true,
        duration: true,
      },
    });
    expect(mockCreateAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: 'cust-1',
          serviceId: 'svc-1',
          serviceIds: ['svc-1'],
          duration: 45,
          endTime: new Date('2026-03-30T15:45:00.000Z'),
        }),
      }),
    );
    expect(mockUpdateCustomer).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      data: {
        smsConsent: true,
        smsOptedOut: false,
        smsOptedOutAt: null,
      },
    });
    expect(mockCreateConsentEvent).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: 'biz-1',
        customerId: 'cust-1',
        phone: '+15551234567',
        eventType: 'MANUAL_APPOINTMENT_OPT_IN',
        source: 'mobile_appointment',
      }),
    });
    expect(mockSendAppointmentConfirmation).toHaveBeenCalledWith(
      '+15551234567',
      expect.objectContaining({
        customerName: 'Jordan Lee',
        serviceName: 'Haircut',
        businessName: 'Clientific Studio',
      }),
    );
    expect(mockScheduleAppointmentReminder).toHaveBeenCalledWith(
      '+15551234567',
      expect.objectContaining({
        customerName: 'Jordan Lee',
        serviceName: 'Haircut',
        staffName: 'Taylor',
      }),
    );
    expect(mockUpdateAppointment).toHaveBeenCalledWith({
      where: { id: 'appt-2' },
      data: { reminderSent: true },
    });
    expect(mockCreateBusinessNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: 'biz-1',
        staffId: 'staff-1',
        type: 'new_appointment',
        title: 'New Appointment',
        message: 'Jordan Lee was scheduled for Haircut with Taylor at Mon, Mar 30, 11:00 AM.',
        link: '/dashboard/appointments',
      }),
    );
  });

  it('creates consecutive mobile appointment segments with per-service staff assignments', async () => {
    mockFindServices.mockResolvedValueOnce([
      { id: 'svc-1', name: 'Haircut', duration: 45 },
      { id: 'svc-2', name: 'Gel manicure', duration: 60 },
    ] as never);
    mockCreateAppointment.mockImplementation(({ data }: any) =>
      Promise.resolve({
        id: data.serviceId === 'svc-1' ? 'appt-haircut' : 'appt-gel',
        customerId: data.customerId,
        duration: data.duration,
        notes: data.notes,
        status: 'scheduled',
        source: 'dashboard',
        shortId: null,
        startTime: data.startTime,
        endTime: data.endTime,
        customer: {
          id: 'cust-1',
          name: 'Jordan Lee',
          phone: '+15551234567',
          smsConsent: true,
          smsOptedOut: false,
        },
        service: {
          id: data.serviceId,
          name: data.serviceId === 'svc-1' ? 'Haircut' : 'Gel manicure',
        },
        staff: data.staffId
          ? {
              id: data.staffId,
              fullName: data.staffId === 'staff-1' ? 'Taylor' : 'Morgan',
            }
          : null,
      }) as never
    );

    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/appointments', {
        method: 'POST',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          customerId: 'cust-1',
          serviceId: 'svc-1',
          serviceIds: ['svc-1', 'svc-2'],
          serviceStaffAssignments: [
            { serviceId: 'svc-1', staffId: 'staff-1' },
            { serviceId: 'svc-2', staffId: 'staff-2' },
          ],
          startTime: '2026-03-30T15:00:00.000Z',
          duration: 999,
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mockCreateAppointment).toHaveBeenCalledTimes(2);
    expect(mockCreateAppointment).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          serviceId: 'svc-1',
          serviceIds: ['svc-1'],
          staffId: 'staff-1',
          endTime: new Date('2026-03-30T15:45:00.000Z'),
          duration: 45,
        }),
      }),
    );
    expect(mockCreateAppointment).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          serviceId: 'svc-2',
          serviceIds: ['svc-2'],
          staffId: 'staff-2',
          startTime: new Date('2026-03-30T15:45:00.000Z'),
          endTime: new Date('2026-03-30T16:45:00.000Z'),
          duration: 60,
        }),
      }),
    );
    expect(mockCreateBusinessNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        staffIds: ['staff-1', 'staff-2'],
        title: 'New Multi-Service Appointment',
        message: expect.stringContaining('Haircut with Taylor, Gel manicure with Morgan'),
      }),
    );
    expect(mockSendAppointmentConfirmation).toHaveBeenCalledWith(
      '+15551234567',
      expect.objectContaining({
        serviceName: 'Haircut with Taylor, Gel manicure with Morgan',
        staffName: 'our team',
        duration: 105,
        appointmentUrl: expect.stringContaining('/appt/batch/'),
      }),
    );
    const body = await response.json();
    expect(body.appointments).toHaveLength(2);
    expect(body.appointmentBatchUrl).toContain('/appt/batch/');
  });

  it('blocks appointment SMS consent when the customer has no phone number', async () => {
    mockFindCustomer.mockResolvedValueOnce({
      id: 'cust-1',
      phone: null,
      smsConsent: false,
      smsOptedOut: false,
    } as never);

    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/appointments', {
        method: 'POST',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          customerId: 'cust-1',
          serviceId: 'svc-1',
          startTime: '2026-03-30T15:00:00.000Z',
          duration: 60,
          appointmentSmsConsent: true,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Customer needs a phone number before appointment texts can be enabled',
    });
    expect(mockCreateAppointment).not.toHaveBeenCalled();
    expect(mockSendAppointmentConfirmation).not.toHaveBeenCalled();
  });

  it('requires an active service for mobile appointment creation', async () => {
    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/appointments', {
        method: 'POST',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          customerId: 'cust-1',
          startTime: '2026-03-30T15:00:00.000Z',
          duration: 60,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Customer, service, and start time are required',
    });
    expect(mockCreateAppointment).not.toHaveBeenCalled();
  });

  it('rejects inactive or cross-business services before creating a mobile appointment', async () => {
    mockFindServices.mockResolvedValueOnce([]);

    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/appointments', {
        method: 'POST',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          customerId: 'cust-1',
          serviceId: 'svc-other-business',
          startTime: '2026-03-30T15:00:00.000Z',
          duration: 60,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Select active services before creating the appointment.',
    });
    expect(mockCreateAppointment).not.toHaveBeenCalled();
  });

  it('rejects customers outside the mobile business before creating an appointment', async () => {
    mockFindCustomer.mockResolvedValueOnce(null);

    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/appointments', {
        method: 'POST',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          customerId: 'cust-other-business',
          serviceId: 'svc-1',
          startTime: '2026-03-30T15:00:00.000Z',
          duration: 60,
        }),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Customer not found',
    });
    expect(mockCreateAppointment).not.toHaveBeenCalled();
  });
});
