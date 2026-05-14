import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/utils', () => ({
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
}));

import { hashPassword } from '@/lib/utils';
import {
  normalizeStaffEmail,
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

  it('requires an email and temporary password when access is enabled for a new staff member', async () => {
    await expect(
      resolveStaffPortalAccessData({
        email: null,
        isCreate: true,
        portalAccessEnabled: true,
        portalPassword: 'temporary123',
      }),
    ).resolves.toEqual({ error: 'Add an email before enabling employee app access.' });

    await expect(
      resolveStaffPortalAccessData({
        email: 'taylor@example.com',
        isCreate: true,
        portalAccessEnabled: true,
        portalPassword: '',
      }),
    ).resolves.toEqual({ error: 'Set a temporary employee app password before enabling access.' });
  });

  it('hashes a supplied password and preserves existing passwords when left blank', async () => {
    const created = await resolveStaffPortalAccessData({
      email: 'taylor@example.com',
      isCreate: true,
      portalAccessEnabled: true,
      portalPassword: 'temporary123',
    });

    expect(created).toEqual({
      data: expect.objectContaining({
        portalAccessEnabled: true,
        portalPasswordHash: 'hashed:temporary123',
        portalPasswordSetAt: expect.any(Date),
      }),
    });
    expect(mockHashPassword).toHaveBeenCalledWith('temporary123');

    const updated = await resolveStaffPortalAccessData({
      email: 'taylor@example.com',
      existing: {
        email: 'taylor@example.com',
        portalAccessEnabled: true,
        portalPasswordHash: 'already-hashed',
      },
      portalAccessEnabled: true,
      portalPassword: '',
    });

    expect(updated).toEqual({ data: { portalAccessEnabled: true } });
  });
});
