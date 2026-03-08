/**
 * Security tests — auth enforcement, IDOR isolation, and input validation.
 *
 * Key things verified:
 * 1. Every protected route returns 401 without a session
 * 2. Prisma queries always scope to the authenticated businessId (IDOR prevention)
 * 3. Public booking & registration enforce input length limits
 * 4. Password strength is enforced at registration
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    customer: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    appointment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    service: { findMany: vi.fn() },
    staff: { findFirst: vi.fn() },
    notification: { create: vi.fn() },
    smsConsentEvent: { create: vi.fn() },
    businessHours: { create: vi.fn() },
  },
}));

vi.mock('@/lib/twilio', () => ({
  sendAppointmentConfirmation: vi.fn().mockResolvedValue({ success: true }),
  formatPhoneNumber: vi.fn((p: string) => p),
}));

vi.mock('@/lib/email', () => ({
  sendNewBookingEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/utils', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed'),
  generateSlug: vi.fn().mockReturnValue('test-biz'),
  generatePublicBusinessId: vi.fn().mockReturnValue('pub123'),
  formatPhoneNumber: vi.fn((p: string) => p),
}));

vi.mock('@/lib/subscription', () => ({
  requireActiveSubscription: vi.fn().mockResolvedValue(null),
  checkPlanLimit: vi.fn().mockResolvedValue({ allowed: true, current: 0, limit: 100 }),
}));

vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ GET: vi.fn(), POST: vi.fn() })),
  getServerSession: vi.fn(),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { GET as customersGET, POST as customersPOST } from '@/app/api/customers/route';
import { GET as appointmentsGET, POST as appointmentsPOST } from '@/app/api/appointments/route';
import { POST as registerPOST } from '@/app/api/auth/register/route';
import { POST as bookBySlugPOST } from '@/app/api/public/business/[slug]/book/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SESSION_A = { user: { email: 'a@test.com', businessId: 'biz-A', id: 'biz-A' } };
const SESSION_B = { user: { email: 'b@test.com', businessId: 'biz-B', id: 'biz-B' } };

const BIZ_A = { id: 'biz-A', name: 'Biz A', email: 'a@test.com', timezone: 'America/New_York', subscriptionStatus: 'active', trialEndsAt: null, enableOnlineBooking: true, notifyNewBookingEmail: false };
const BIZ_B = { id: 'biz-B', name: 'Biz B', email: 'b@test.com', timezone: 'America/New_York', subscriptionStatus: 'active', trialEndsAt: null };

function req(method: string, body?: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/test', {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  });
}

function reqWithParams(method: string, url: string, body?: Record<string, unknown>) {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Auth Enforcement ──────────────────────────────────────────────────────────

describe('Auth enforcement — 401 without session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(null);
  });

  it('GET /api/customers returns 401', async () => {
    const res = await customersGET(req('GET'));
    expect(res.status).toBe(401);
  });

  it('POST /api/customers returns 401', async () => {
    const res = await customersPOST(req('POST', { name: 'Test' }));
    expect(res.status).toBe(401);
  });

  it('GET /api/appointments returns 401', async () => {
    const res = await appointmentsGET(req('GET'));
    expect(res.status).toBe(401);
  });

  it('POST /api/appointments returns 401', async () => {
    const res = await appointmentsPOST(req('POST', {}));
    expect(res.status).toBe(401);
  });
});

// ── IDOR: BusinessId Isolation ────────────────────────────────────────────────

describe('IDOR — businessId isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/customers always scopes query to authenticated businessId', async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_A as any);
    vi.mocked(prisma.customer.findMany).mockResolvedValue([]);

    await customersGET(req('GET'));

    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ businessId: 'biz-A' }),
      })
    );
    // Must NOT have biz-B's ID
    const call = vi.mocked(prisma.customer.findMany).mock.calls[0][0];
    expect(JSON.stringify(call)).not.toContain('biz-B');
  });

  it('POST /api/customers always creates customer under authenticated businessId', async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_A as any);
    vi.mocked(prisma.customer.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.customer.create).mockResolvedValue({
      id: 'cust-1', businessId: 'biz-A', name: 'Jane', email: null, phone: null,
      birthday: null, notes: null, segment: 'NEW', points: 0, totalSpent: 0,
      smsConsent: false, smsOptedOut: false, createdAt: new Date(), updatedAt: new Date(),
    } as any);

    await customersPOST(req('POST', { name: 'Jane' }));

    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ businessId: 'biz-A' }),
      })
    );
    const createCall = vi.mocked(prisma.customer.create).mock.calls[0][0];
    expect(JSON.stringify(createCall)).not.toContain('biz-B');
  });

  it('GET /api/appointments always scopes to authenticated businessId', async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_A as any);
    vi.mocked(prisma.business.findUnique).mockResolvedValue(BIZ_A as any);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);

    await appointmentsGET(req('GET'));

    const call = vi.mocked(prisma.appointment.findMany).mock.calls[0][0];
    expect(JSON.stringify(call)).toContain('biz-A');
    expect(JSON.stringify(call)).not.toContain('biz-B');
  });

  it('authenticated user cannot access business data by switching businessId in payload', async () => {
    // User authenticated as biz-A tries to create a customer for biz-B via body
    vi.mocked(getServerSession).mockResolvedValue(SESSION_A as any);
    vi.mocked(prisma.customer.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.customer.create).mockResolvedValue({
      id: 'cust-1', businessId: 'biz-A', name: 'Hack', email: null, phone: null,
      birthday: null, notes: null, segment: 'NEW', points: 0, totalSpent: 0,
      smsConsent: false, smsOptedOut: false, createdAt: new Date(), updatedAt: new Date(),
    } as any);

    // Attacker passes businessId: 'biz-B' in the body — the route should ignore it
    await customersPOST(req('POST', { name: 'Hack', businessId: 'biz-B' }));

    // The customer must be created under biz-A regardless
    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ businessId: 'biz-A' }),
      })
    );
  });
});

// ── Registration Input Validation ─────────────────────────────────────────────

describe('POST /api/auth/register — input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await registerPOST(req('POST', { email: 'a@a.com' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing required/i);
  });

  it('returns 400 for password shorter than 8 characters', async () => {
    const res = await registerPOST(req('POST', {
      email: 'a@a.com', password: 'short', businessName: 'Test Biz', phone: '5555555555',
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/password/i);
  });

  it('returns 400 for password longer than 128 characters', async () => {
    const res = await registerPOST(req('POST', {
      email: 'a@a.com',
      password: 'a'.repeat(129),
      businessName: 'Test Biz',
      phone: '5555555555',
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/password/i);
  });

  it('returns 400 for business name longer than 100 characters', async () => {
    const res = await registerPOST(req('POST', {
      email: 'a@a.com',
      password: 'validpassword1',
      businessName: 'B'.repeat(101),
      phone: '5555555555',
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/business name/i);
  });

  it('accepts a valid registration payload', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.business.create).mockResolvedValue({
      id: 'biz-1', email: 'a@a.com', name: 'Test Biz', slug: 'test-biz',
    } as any);
    vi.mocked(prisma.businessHours.create).mockResolvedValue({} as any);

    const res = await registerPOST(req('POST', {
      email: 'new@test.com',
      password: 'ValidPass123',
      businessName: 'Test Salon',
      phone: '5551234567',
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ── Public Booking Input Validation ───────────────────────────────────────────

describe('POST /api/public/business/[slug]/book — input validation', () => {
  const bookParams = { params: Promise.resolve({ slug: 'test-salon' }) };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.business.findUnique).mockResolvedValue(BIZ_A as any);
    vi.mocked(prisma.service.findMany).mockResolvedValue([
      { id: 'svc-1', name: 'Haircut', businessId: 'biz-A', duration: 60, price: 50 },
    ] as any);
    vi.mocked(prisma.staff.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.customer.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.customer.create).mockResolvedValue({
      id: 'cust-1', name: 'Jane', phone: '+15551234567', smsConsent: false, smsOptedOut: false,
    } as any);
    vi.mocked(prisma.appointment.create).mockResolvedValue({
      id: 'appt-1', shortId: 'ABC1234',
      customer: { name: 'Jane', phone: null },
      service: { name: 'Haircut' },
      staff: null,
      business: { name: 'Biz A' },
      startTime: new Date(),
      duration: 60,
      notes: null,
    } as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any);
  });

  const validBody = {
    serviceIds: ['svc-1'],
    startTime: new Date(Date.now() + 86400000).toISOString(),
    duration: 60,
    customerName: 'Jane Doe',
    customerPhone: '+15551234567',
    smsConsent: false,
  };

  it('returns 400 when customerName exceeds 100 characters', async () => {
    const r = reqWithParams('POST', 'http://localhost/api/public/business/test-salon/book', {
      ...validBody,
      customerName: 'J'.repeat(101),
    });
    const res = await bookBySlugPOST(r, bookParams);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/name/i);
  });

  it('returns 400 when customerEmail exceeds 254 characters', async () => {
    const r = reqWithParams('POST', 'http://localhost/api/public/business/test-salon/book', {
      ...validBody,
      customerEmail: 'a'.repeat(250) + '@x.com',
    });
    const res = await bookBySlugPOST(r, bookParams);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/email/i);
  });

  it('returns 400 when notes exceed 1000 characters', async () => {
    const r = reqWithParams('POST', 'http://localhost/api/public/business/test-salon/book', {
      ...validBody,
      notes: 'x'.repeat(1001),
    });
    const res = await bookBySlugPOST(r, bookParams);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/notes/i);
  });

  it('returns 400 for duration below 5 minutes', async () => {
    const r = reqWithParams('POST', 'http://localhost/api/public/business/test-salon/book', {
      ...validBody,
      duration: 4,
    });
    const res = await bookBySlugPOST(r, bookParams);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/duration/i);
  });

  it('returns 400 for duration above 480 minutes (8 hours)', async () => {
    const r = reqWithParams('POST', 'http://localhost/api/public/business/test-salon/book', {
      ...validBody,
      duration: 481,
    });
    const res = await bookBySlugPOST(r, bookParams);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/duration/i);
  });

  it('returns 400 when business has online booking disabled', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      ...BIZ_A, enableOnlineBooking: false,
    } as any);
    const r = reqWithParams('POST', 'http://localhost/api/public/business/test-salon/book', validBody);
    const res = await bookBySlugPOST(r, bookParams);
    expect(res.status).toBe(403);
  });

  it('returns 400 when required fields are missing', async () => {
    const r = reqWithParams('POST', 'http://localhost/api/public/business/test-salon/book', {
      serviceIds: ['svc-1'],
      // missing startTime, duration, customerName, customerPhone
    });
    const res = await bookBySlugPOST(r, bookParams);
    expect(res.status).toBe(400);
  });

  it('returns 404 when business slug does not exist', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null);
    const r = reqWithParams('POST', 'http://localhost/api/public/business/ghost/book', validBody);
    const res = await bookBySlugPOST(r, { params: Promise.resolve({ slug: 'ghost' }) });
    expect(res.status).toBe(404);
  });

  it('rejects a service ID that does not belong to the business', async () => {
    // Only return empty array — service not found for this business
    vi.mocked(prisma.service.findMany).mockResolvedValue([]);
    const r = reqWithParams('POST', 'http://localhost/api/public/business/test-salon/book', {
      ...validBody,
      serviceIds: ['svc-from-other-biz'],
    });
    const res = await bookBySlugPOST(r, bookParams);
    expect(res.status).toBe(404);
  });
});
