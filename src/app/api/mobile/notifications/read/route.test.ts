import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-route', () => ({
  requireMobileSession: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      updateMany: vi.fn(),
    },
  },
}));

import { requireMobileSession } from '@/lib/mobile-route';
import { prisma } from '@/lib/prisma';
import { PATCH } from './route';

const mockRequireMobileSession = vi.mocked(requireMobileSession);
const mockUpdateNotifications = vi.mocked(prisma.notification.updateMany);

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileSession.mockResolvedValue({
    session: {
      businessId: 'biz-1',
    },
  } as never);
});

describe('PATCH /api/mobile/notifications/read', () => {
  it('marks mobile notifications as read for the signed-in business', async () => {
    const response = await PATCH(
      new Request('https://www.clientific.app/api/mobile/notifications/read', {
        method: 'PATCH',
      }),
    );

    expect(response.status).toBe(200);
    expect(mockUpdateNotifications).toHaveBeenCalledWith({
      where: {
        businessId: 'biz-1',
        read: false,
      },
      data: expect.objectContaining({
        read: true,
      }),
    });
  });

  it('returns the mobile auth error when there is no session', async () => {
    const unauthorized = Response.json({ error: 'Mobile sign-in is required.' }, { status: 401 });
    mockRequireMobileSession.mockResolvedValue({ error: unauthorized } as never);

    const response = await PATCH(
      new Request('https://www.clientific.app/api/mobile/notifications/read', {
        method: 'PATCH',
      }),
    );

    expect(response.status).toBe(401);
  });
});
