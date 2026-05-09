import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-route', () => ({
  requireMobileSession: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
    },
    notification: {
      findMany: vi.fn(),
    },
  },
}));

import { requireMobileSession } from '@/lib/mobile-route';
import { prisma } from '@/lib/prisma';
import { GET } from './route';

const mockRequireMobileSession = vi.mocked(requireMobileSession);
const mockFindBusiness = vi.mocked(prisma.business.findUnique);
const mockFindNotifications = vi.mocked(prisma.notification.findMany);

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileSession.mockResolvedValue({
    session: {
      businessId: 'biz-1',
    },
  } as never);
});

describe('GET /api/mobile/notifications', () => {
  it('returns mobile notifications with unread counts and display labels', async () => {
    mockFindBusiness.mockResolvedValue({
      id: 'biz-1',
      email: 'owner@clientific.app',
      name: 'Clientific Studio',
      businessType: 'Salon',
      phone: '+15551234567',
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US',
    } as never);
    mockFindNotifications.mockResolvedValue([
      {
        id: 'notif-1',
        type: 'new_appointment',
        title: 'New appointment',
        message: 'Jordan Lee booked Haircut',
        link: '/dashboard/appointments',
        read: false,
        createdAt: new Date('2026-05-08T10:30:00.000Z'),
      },
      {
        id: 'notif-2',
        type: 'appointment_rescheduled',
        title: 'Appointment moved',
        message: 'Jordan Lee moved to 1:00 PM',
        link: '/dashboard/appointments',
        read: true,
        createdAt: new Date('2026-05-08T09:00:00.000Z'),
      },
    ] as never);

    const response = await GET(new Request('https://www.clientific.app/api/mobile/notifications'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.unreadCount).toBe(1);
    expect(body.business).toMatchObject({
      id: 'biz-1',
      name: 'Clientific Studio',
      onboardingComplete: true,
    });
    expect(body.notifications[0]).toMatchObject({
      id: 'notif-1',
      type: 'new_appointment',
      read: false,
      link: '/dashboard/appointments',
    });
    expect(body.notifications[0].createdAtLabel).toContain('May');
  });

  it('returns the mobile auth error when there is no session', async () => {
    const unauthorized = Response.json({ error: 'Mobile sign-in is required.' }, { status: 401 });
    mockRequireMobileSession.mockResolvedValue({ error: unauthorized } as never);

    const response = await GET(new Request('https://www.clientific.app/api/mobile/notifications'));

    expect(response.status).toBe(401);
  });
});
