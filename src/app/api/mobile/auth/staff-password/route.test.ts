import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-route', () => ({
  requireMobileSession: vi.fn(),
}));
vi.mock('@/lib/mobile-session', () => ({
  createMobileSessionToken: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    staff: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock('@/lib/utils', () => ({
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
  verifyPassword: vi.fn(),
}));

import { createMobileSessionToken } from '@/lib/mobile-session';
import { requireMobileSession } from '@/lib/mobile-route';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/utils';
import { POST } from './route';

const mockRequireMobileSession = vi.mocked(requireMobileSession);
const mockCreateMobileSessionToken = vi.mocked(createMobileSessionToken);
const mockFindStaff = vi.mocked(prisma.staff.findFirst);
const mockUpdateStaff = vi.mocked(prisma.staff.update);
const mockVerifyPassword = vi.mocked(verifyPassword);

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileSession.mockResolvedValue({
    session: {
      businessId: 'biz-1',
      email: 'taylor@example.com',
      name: 'Taylor',
      onboardingComplete: false,
      accountType: 'staff',
      staffId: 'staff-1',
      staffName: 'Taylor',
      staffPasswordChangeRequired: true,
    },
  } as never);
  mockFindStaff.mockResolvedValue({
    id: 'staff-1',
    fullName: 'Taylor Nguyen',
    email: 'taylor@example.com',
    portalPasswordHash: 'hashed-temp',
    business: {
      id: 'biz-1',
      email: 'owner@clientific.app',
      name: 'Clientific Studio',
    },
  } as never);
  mockUpdateStaff.mockResolvedValue({
    id: 'staff-1',
    fullName: 'Taylor Nguyen',
    email: 'taylor@example.com',
    business: {
      id: 'biz-1',
      email: 'owner@clientific.app',
      name: 'Clientific Studio',
    },
  } as never);
  mockVerifyPassword.mockResolvedValue(true);
  mockCreateMobileSessionToken.mockResolvedValue('fresh-mobile-token');
});

describe('POST /api/mobile/auth/staff-password', () => {
  it('updates the temporary staff password and returns a fresh mobile token', async () => {
    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/auth/staff-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
        body: JSON.stringify({
          currentPassword: 'temporary123',
          newPassword: 'newpassword123',
        }),
      }),
    );

    expect(mockRequireMobileSession).toHaveBeenCalledWith(expect.any(Request), {
      allowStaff: true,
      allowPasswordChangeRequired: true,
    });
    expect(response.status).toBe(200);
    expect(mockVerifyPassword).toHaveBeenCalledWith('temporary123', 'hashed-temp');
    expect(mockUpdateStaff).toHaveBeenCalledWith({
      where: { id: 'staff-1' },
      data: expect.objectContaining({
        portalPasswordHash: 'hashed:newpassword123',
        portalPasswordSetAt: expect.any(Date),
      }),
      select: expect.any(Object),
    });
    expect(mockCreateMobileSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({
        accountType: 'staff',
        staffId: 'staff-1',
        staffPasswordChangeRequired: false,
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      token: 'fresh-mobile-token',
      viewer: {
        role: 'staff',
        passwordChangeRequired: false,
      },
    });
  });
});
