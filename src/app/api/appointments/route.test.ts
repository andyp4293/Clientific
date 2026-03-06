import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    appointment: { findMany: vi.fn(), create: vi.fn() },
    notification: { create: vi.fn() },
  },
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {},
  PRICING_PLANS: {
    STARTER: { name: 'Starter', limits: { customers: 100, staff: 2, services: 10 } },
    PRO: { name: 'Pro', limits: { customers: 1000, staff: 10, services: 50 } },
    PREMIUM: { name: 'Premium', limits: { customers: Infinity, staff: Infinity, services: Infinity } },
  },
}));

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
vi.mock('@/lib/twilio', () => ({ sendAppointmentConfirmation: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/email', () => ({ sendNewBookingEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/timezone', () => ({ businessDayStart: vi.fn((date: string) => new Date(date)) }));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET, POST } from './route';

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockAppointmentFindMany = prisma.appointment.findMany as ReturnType<typeof vi.fn>;
const mockAppointmentCreate = prisma.appointment.create as ReturnType<typeof vi.fn>;
const mockNotificationCreate = prisma.notification.create as ReturnType<typeof vi.fn>;

// Appointments use session.user.email for business lookup, session.user.businessId for subscription
const activeSession = { user: { businessId: 'biz-1', email: 'owner@test.com' } };
const fakeBusiness = {
  id: 'biz-1',
  email: 'owner@test.com',
  name: 'Test Salon',
  timezone: 'America/New_York',
  notifyNewBookingEmail: false,
  subscriptionStatus: 'active',
  trialEndsAt: null,
};

const validApptBody = {
  customerId: 'cust-1',
  startTime: new Date(Date.now() + 3600000).toISOString(),
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
});
