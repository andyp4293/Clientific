import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-session', () => ({
  getBearerToken: vi.fn(),
  verifyMobileSessionToken: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));
vi.mock('@/lib/phone', () => ({
  normalizeOptionalStoredPhoneNumber: vi.fn((value: string) => `+1${value.replace(/\D/g, '')}`),
}));
vi.mock('@/lib/moderation', () => ({
  blockedContentError: vi.fn((label: string) => `${label} is not allowed`),
  getBlockedFieldLabel: vi.fn(() => null),
}));

import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { prisma } from '@/lib/prisma';
import { DELETE, GET, PATCH } from './route';

const mockGetBearerToken = getBearerToken as ReturnType<typeof vi.fn>;
const mockVerifyMobileSessionToken = verifyMobileSessionToken as ReturnType<typeof vi.fn>;
const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockUpdateBusiness = prisma.business.update as ReturnType<typeof vi.fn>;
const mockDeleteBusiness = prisma.business.delete as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBearerToken.mockReturnValue('token');
  mockVerifyMobileSessionToken.mockResolvedValue({ businessId: 'biz-1' });
  mockFindBusiness.mockResolvedValue({
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    businessType: 'Salon',
    ownerPhone: null,
    phone: null,
    businessEmail: null,
    street: null,
    city: null,
    state: null,
    zipCode: null,
    country: null,
    timezone: 'America/New_York',
  });
  mockUpdateBusiness.mockResolvedValue({
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    businessType: 'Salon',
    ownerPhone: '+15550001111',
    phone: '+15551234567',
    businessEmail: 'hello@clientific.app',
    street: '123 Main St',
    city: 'New York',
    state: 'NY',
    zipCode: '10001',
    country: 'United States',
    timezone: 'America/New_York',
  });
  mockDeleteBusiness.mockResolvedValue({ id: 'biz-1' });
});

describe('mobile business route', () => {
  it('returns the current business profile for a valid mobile token', async () => {
    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/business', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.business.name).toBe('Clientific Studio');
    expect(body.business.onboardingComplete).toBe(false);
  });

  it('updates the mobile onboarding profile', async () => {
    const response = await PATCH(
      new Request('https://www.clientific.app/api/mobile/business', {
        method: 'PATCH',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          ownerPhone: '(555) 000-1111',
          phone: '(555) 123-4567',
          businessEmail: 'hello@clientific.app',
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'United States',
          timezone: 'America/New_York',
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.business.onboardingComplete).toBe(true);
    expect(mockUpdateBusiness).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'biz-1' },
        data: expect.objectContaining({
          phone: '+15551234567',
          city: 'New York',
        }),
      }),
    );
  });

  it('rejects invalid onboarding submissions without a business phone', async () => {
    const response = await PATCH(
      new Request('https://www.clientific.app/api/mobile/business', {
        method: 'PATCH',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          phone: '',
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'United States',
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mockUpdateBusiness).not.toHaveBeenCalled();
  });

  it('deletes the signed-in business account', async () => {
    const response = await DELETE(
      new Request('https://www.clientific.app/api/mobile/business', {
        method: 'DELETE',
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mockDeleteBusiness).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
    });
  });
});
