import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
  },
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET } from './route';

const mockBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue(null);
});

describe('GET /api/public/business/[slug]', () => {
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

    const req = new NextRequest('http://localhost/api/public/business/test-salon?infoOnly=true');
    const res = await GET(req, { params: Promise.resolve({ slug: 'test-salon' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.business.phone).toBeNull();
    expect(body.business.businessEmail).toBeNull();
    expect(body.business.publicProfileShowPhone).toBe(false);
    expect(body.business.publicProfileShowEmail).toBe(false);
  });

  it('marks viewerCanManage true for the owning business session', async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: 'user-1',
        businessId: 'biz-1',
      },
    });
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

    const req = new NextRequest('http://localhost/api/public/business/test-salon?infoOnly=true');
    const res = await GET(req, { params: Promise.resolve({ slug: 'test-salon' }) });

    const body = await res.json();
    expect(body.viewerCanManage).toBe(true);
  });

  it('removes unsafe external links from public business responses', async () => {
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
      logoUrl: 'javascript:alert(1)',
      publicProfileHeadline: null,
      publicProfileAbout: null,
      publicProfileShowPhone: false,
      publicProfileShowEmail: false,
      publicProfileShowAddress: true,
      publicProfileShowHours: true,
      publicProfileShowServices: true,
      publicProfileShowTeam: false,
      publicProfileShowSocialLinks: true,
      googleReviewUrl: 'javascript:alert(1)',
      facebookPageUrl: 'https://facebook.com/testsalon',
      yelpUrl: 'data:text/html,<script>alert(1)</script>',
      instagramUrl: null,
      enableOnlineBooking: true,
      businessHours: null,
    });

    const req = new NextRequest('http://localhost/api/public/business/test-salon?infoOnly=true');
    const res = await GET(req, { params: Promise.resolve({ slug: 'test-salon' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.business.logoUrl).toBeNull();
    expect(body.business.googleReviewUrl).toBeNull();
    expect(body.business.facebookPageUrl).toBe('https://facebook.com/testsalon');
    expect(body.business.yelpUrl).toBeNull();
  });
});
