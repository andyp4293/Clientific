import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    businessHours: {
      create: vi.fn(),
    },
    referral: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/utils', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-password'),
  generateSlug: vi.fn().mockReturnValue('test-business'),
  generatePublicBusinessId: vi.fn().mockReturnValue('pub-abc123'),
}));

vi.mock('@/lib/auth-verification', () => ({
  createEmailVerificationCode: vi.fn(() => ({
    token: '123456',
    tokenHash: 'hash',
    expiresAt: new Date('2026-04-20T00:00:00.000Z'),
  })),
  isValidEmail: vi.fn(() => true),
  normalizeEmail: vi.fn((email: string) => email.trim().toLowerCase()),
  packVerificationHash: vi.fn(() => 'packed-hash'),
}));

vi.mock('@/lib/email', () => ({
  sendEmailVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/referral', () => ({
  generateReferralCode: vi.fn().mockResolvedValue('REF12345'),
}));

vi.mock('@/lib/referral-sharing', () => ({
  getReferralSharingStatus: vi.fn(() => ({ ready: true })),
  resolveReferralSharingStatus: vi.fn().mockResolvedValue({ ready: true }),
}));

vi.mock('@/lib/phone', () => ({
  normalizeOptionalStoredPhoneNumber: vi.fn((value: string) => value),
}));

vi.mock('@/lib/moderation', () => ({
  blockedContentError: vi.fn((label: string) => `${label} blocked`),
  getBlockedFieldLabel: vi.fn(() => null),
}));

import { prisma } from '@/lib/prisma';
import { POST } from './route';

const mockFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockCreateBusiness = prisma.business.create as ReturnType<typeof vi.fn>;
const mockCreateBusinessHours = prisma.businessHours.create as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockFindUnique.mockResolvedValue(null);
  mockCreateBusiness.mockResolvedValue({
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    slug: 'test-business',
  });
  mockCreateBusinessHours.mockResolvedValue({});
});

describe('POST /api/mobile/auth/register', () => {
  it('creates inactive iPhone businesses with no website billing provider', async () => {
    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'owner@clientific.app',
          password: 'Password123!',
          businessName: 'Clientific Studio',
          businessType: 'Salon',
          timezone: 'America/New_York',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockCreateBusiness).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subscriptionPlan: 'trial',
          subscriptionStatus: 'inactive',
          billingProvider: 'none',
          trialEndsAt: null,
          subscriptionCurrentPeriodEnd: null,
        }),
      }),
    );
  });

  it('returns a route-level validation error when required fields are missing', async () => {
    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'owner@clientific.app' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Missing required fields' });
  });
});
