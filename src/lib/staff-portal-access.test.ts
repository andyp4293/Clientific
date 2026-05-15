import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/utils', () => ({
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
}));

import { hashPassword } from '@/lib/utils';
import {
  isStaffPasswordChangeRequired,
  normalizeStaffEmail,
  resolveStaffPasswordChangeData,
  resolveStaffPortalAccessData,
} from './staff-portal-access';

const mockHashPassword = vi.mocked(hashPassword);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('staff portal access helpers', () => {
  it('normalizes staff emails before storing login credentials', () => {
    expect(normalizeStaffEmail(' Taylor@Example.com ')).toBe('taylor@example.com');
    expect(normalizeStaffEmail('')).toBeNull();
  });

  it('requires an email when access is enabled for a new staff member', async () => {
    await expect(
      resolveStaffPortalAccessData({
        email: null,
        isCreate: true,
        portalAccessEnabled: true,
        portalPassword: 'temporary123',
      }),
    ).resolves.toEqual({ error: 'Add an email before enabling employee app access.' });
  });

  it('generates a temporary password and preserves existing passwords when left blank', async () => {
    const created = await resolveStaffPortalAccessData({
      email: 'taylor@example.com',
      isCreate: true,
      portalAccessEnabled: true,
      portalPassword: '',
    });

    expect(created).toEqual({
      data: expect.objectContaining({
        portalAccessEnabled: true,
        portalPasswordHash: expect.stringMatching(/^hashed:/),
        portalPasswordSetAt: null,
      }),
      temporaryPassword: expect.any(String),
    });
    expect(mockHashPassword).toHaveBeenCalledWith(expect.any(String));

    const updated = await resolveStaffPortalAccessData({
      email: 'taylor@example.com',
      existing: {
        email: 'taylor@example.com',
        portalAccessEnabled: true,
        portalPasswordHash: 'already-hashed',
        portalPasswordSetAt: new Date(),
      },
      portalAccessEnabled: true,
      portalPassword: '',
    });

    expect(updated).toEqual({ data: { portalAccessEnabled: true } });
  });

  it('marks generated and owner-supplied temporary passwords as requiring employee setup', async () => {
    const result = await resolveStaffPortalAccessData({
      email: 'taylor@example.com',
      isCreate: true,
      portalAccessEnabled: true,
      portalPassword: 'temporary123',
    });

    expect(result).toEqual({
      data: expect.objectContaining({
        portalPasswordHash: 'hashed:temporary123',
        portalPasswordSetAt: null,
      }),
      temporaryPassword: 'temporary123',
    });
    expect(
      isStaffPasswordChangeRequired({
        portalAccessEnabled: true,
        portalPasswordHash: 'hashed',
        portalPasswordSetAt: null,
      }),
    ).toBe(true);
  });

  it('hashes employee-created passwords with a completed setup timestamp', async () => {
    const result = await resolveStaffPasswordChangeData('newpassword123');

    expect(result).toEqual({
      data: expect.objectContaining({
        portalPasswordHash: 'hashed:newpassword123',
        portalPasswordSetAt: expect.any(Date),
      }),
    });
  });
});
