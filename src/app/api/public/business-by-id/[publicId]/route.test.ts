import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { GET } from './route';

const mockBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/public/business-by-id/[publicId]', () => {
  it('redacts phone and email from public business responses', async () => {
    mockBusiness.mockResolvedValue({
      id: 'biz-1',
      name: 'Test Salon',
      slug: 'test-salon',
      publicId: 'CF-123456',
      businessType: 'SALON',
      phone: '+15551234567',
      businessEmail: 'owner@testsalon.com',
      street: '1 Main St',
      city: 'Brick',
      state: 'NJ',
      zipCode: '08723',
      country: 'US',
      timezone: 'America/New_York',
      logoUrl: null,
      publicProfileHeadline: null,
      publicProfileAbout: null,
      publicProfileShowPhone: true,
      publicProfileShowEmail: true,
      publicProfileShowAddress: true,
      publicProfileShowHours: true,
      publicProfileShowServices: true,
      publicProfileShowTeam: false,
      publicProfileShowSocialLinks: true,
      googleReviewUrl: null,
      facebookPageUrl: null,
      yelpUrl: null,
      instagramUrl: null,
      enableOnlineBooking: true,
      businessHours: null,
    });

    const req = new NextRequest('http://localhost/api/public/business-by-id/CF-123456?infoOnly=true');
    const res = await GET(req, { params: Promise.resolve({ publicId: 'CF-123456' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.business.phone).toBeNull();
    expect(body.business.businessEmail).toBeNull();
    expect(body.business.publicProfileShowPhone).toBe(false);
    expect(body.business.publicProfileShowEmail).toBe(false);
  });
});
