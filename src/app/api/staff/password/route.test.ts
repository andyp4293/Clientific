import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
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

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/utils';
import { POST } from './route';

const mockGetServerSession = vi.mocked(getServerSession);
const mockFindStaff = vi.mocked(prisma.staff.findFirst);
const mockUpdateStaff = vi.mocked(prisma.staff.update);
const mockVerifyPassword = vi.mocked(verifyPassword);

function makeRequest(body: Record<string, unknown>) {
  return new Request('https://www.clientific.app/api/staff/password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue({
    user: {
      businessId: 'biz-1',
      accountType: 'staff',
      staffId: 'staff-1',
    },
  } as never);
  mockFindStaff.mockResolvedValue({
    id: 'staff-1',
    portalPasswordHash: 'hashed-temp',
  } as never);
  mockVerifyPassword.mockResolvedValue(true);
  mockUpdateStaff.mockResolvedValue({ id: 'staff-1' } as never);
});

describe('POST /api/staff/password', () => {
  it('sets a permanent staff password after verifying the temporary password', async () => {
    const response = await POST(
      makeRequest({
        currentPassword: 'temporary123',
        newPassword: 'newpassword123',
      }),
    );

    expect(response.status).toBe(200);
    expect(mockVerifyPassword).toHaveBeenCalledWith('temporary123', 'hashed-temp');
    expect(mockUpdateStaff).toHaveBeenCalledWith({
      where: { id: 'staff-1' },
      data: expect.objectContaining({
        portalPasswordHash: 'hashed:newpassword123',
        portalPasswordSetAt: expect.any(Date),
      }),
    });
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it('rejects an incorrect temporary password', async () => {
    mockVerifyPassword.mockResolvedValue(false);

    const response = await POST(
      makeRequest({
        currentPassword: 'wrong',
        newPassword: 'newpassword123',
      }),
    );

    expect(response.status).toBe(400);
    expect(mockUpdateStaff).not.toHaveBeenCalled();
  });
});
