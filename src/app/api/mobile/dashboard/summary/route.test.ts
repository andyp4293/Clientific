import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-session', () => ({
  getBearerToken: vi.fn(),
  verifyMobileSessionToken: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    staff: { findFirst: vi.fn() },
    checkIn: { count: vi.fn() },
    appointment: { findMany: vi.fn() },
    referral: { count: vi.fn() },
    referralCommission: { aggregate: vi.fn() },
  },
}));
vi.mock('@/lib/timezone', () => ({
  localToUTC: vi.fn(() => new Date('2026-03-30T04:00:00.000Z')),
}));

import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { GET } from './route';

const mockGetBearerToken = getBearerToken as ReturnType<typeof vi.fn>;
const mockVerifyMobileSessionToken = verifyMobileSessionToken as ReturnType<typeof vi.fn>;
const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockFindStaff = prisma.staff.findFirst as ReturnType<typeof vi.fn>;
const mockCheckInCount = prisma.checkIn.count as ReturnType<typeof vi.fn>;
const mockFindAppointments = prisma.appointment.findMany as ReturnType<typeof vi.fn>;
const mockReferralCount = prisma.referral.count as ReturnType<typeof vi.fn>;
const mockReferralAggregate = prisma.referralCommission.aggregate as ReturnType<typeof vi.fn>;

const activeSubscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBearerToken.mockReturnValue('token');
  mockVerifyMobileSessionToken.mockResolvedValue({ businessId: 'biz-1' });
  mockFindBusiness.mockResolvedValue({
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    businessType: 'Salon',
    timezone: 'America/New_York',
    trialEndsAt: null,
    subscriptionPlan: 'starter',
    subscriptionStatus: 'active',
    billingProvider: 'stripe',
    subscriptionCurrentPeriodEnd: activeSubscriptionEnd,
    phone: '+15551234567',
    street: '123 Main St',
    city: 'New York',
    state: 'NY',
    zipCode: '10001',
    country: 'US',
    stripeConnectAccountId: 'acct_1',
    stripeConnectChargesEnabled: true,
    stripeConnectPayoutsEnabled: true,
    stripeConnectDetailsSubmitted: true,
  });
  mockFindStaff.mockResolvedValue({ id: 'staff-1', fullName: 'Taylor' });
  mockCheckInCount.mockResolvedValue(3);
  mockFindAppointments.mockResolvedValue([
    {
      id: 'appt-1',
      status: 'confirmed',
      startTime: new Date('2026-03-30T15:30:00.000Z'),
      customer: { name: 'Jordan Lee' },
      service: { name: 'Haircut' },
    },
  ]);
  mockReferralCount
    .mockResolvedValueOnce(2)
    .mockResolvedValueOnce(1);
  mockReferralAggregate.mockResolvedValue({
    _sum: {
      amountDollars: 87,
    },
  });
});

describe('GET /api/mobile/dashboard/summary', () => {
  it('returns a business-first mobile home summary for a valid mobile token', async () => {
    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/dashboard/summary', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.business.name).toBe('Clientific Studio');
    expect(body.metrics[0]).toEqual({
      label: 'Booked today',
      value: '1',
      helper: 'Appointment',
    });
    expect(body.referralSnapshot).toEqual(
      expect.objectContaining({
        activeCount: 2,
        pendingCount: 1,
        lifetimeCredits: 87,
        payoutReady: true,
      }),
    );
    expect(body.todayAppointments[0].customerName).toBe('Jordan Lee');
    expect(body.subscription).toEqual({
      plan: 'starter',
      status: 'active',
      billingProvider: 'stripe',
      isActive: true,
      requiresPurchase: false,
    });
  });

  it('returns a privacy-safe employee home for staff sessions', async () => {
    mockVerifyMobileSessionToken.mockResolvedValueOnce({
      businessId: 'biz-1',
      accountType: 'staff',
      staffId: 'staff-1',
      staffName: 'Taylor',
    });
    mockFindAppointments.mockResolvedValueOnce([
      {
        id: 'appt-1',
        status: 'pending',
        startTime: new Date('2026-03-30T15:30:00.000Z'),
        customer: { name: 'Jordan Lee' },
        service: { name: 'Haircut' },
      },
    ]);

    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/dashboard/summary', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockFindStaff).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'staff-1',
          businessId: 'biz-1',
          portalAccessEnabled: true,
        }),
      }),
    );
    const body = await response.json();
    expect(body.viewer).toEqual(
      expect.objectContaining({
        role: 'staff',
        staffId: 'staff-1',
        privacy: 'customer_phone_hidden',
      }),
    );
    expect(body.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Privacy', value: 'On' }),
      ]),
    );
    expect(JSON.stringify(body)).not.toContain('+15551234567');
    expect(body.subscription.requiresPurchase).toBe(false);
  });

  it('returns 401 when the bearer token is missing', async () => {
    mockGetBearerToken.mockReturnValue(null);

    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/dashboard/summary'),
    );

    expect(response.status).toBe(401);
  });

  it('marks inactive iPhone businesses as requiring an App Store purchase', async () => {
    mockFindBusiness.mockResolvedValue({
      id: 'biz-1',
      email: 'owner@clientific.app',
      name: 'Clientific Studio',
      businessType: 'Salon',
      timezone: 'America/New_York',
      trialEndsAt: null,
      subscriptionPlan: 'trial',
      subscriptionStatus: 'inactive',
      billingProvider: 'none',
      subscriptionCurrentPeriodEnd: null,
      phone: '+15551234567',
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US',
      stripeConnectAccountId: null,
      stripeConnectChargesEnabled: false,
      stripeConnectPayoutsEnabled: false,
      stripeConnectDetailsSubmitted: false,
    });

    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/dashboard/summary', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.subscription).toEqual({
      plan: 'trial',
      status: 'inactive',
      billingProvider: 'none',
      isActive: false,
      requiresPurchase: true,
    });
  });
});
