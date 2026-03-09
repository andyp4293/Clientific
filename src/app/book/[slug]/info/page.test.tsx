import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRedirect, mockNotFound, mockResolvePublicBusinessIdOrNull } = vi.hoisted(() => ({
  mockRedirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  mockResolvePublicBusinessIdOrNull: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
  notFound: mockNotFound,
}));

vi.mock('@/lib/public-business-id', () => ({
  resolvePublicBusinessIdOrNull: mockResolvePublicBusinessIdOrNull,
}));

import LegacyBusinessInfoRedirectPage from './page';

describe('LegacyBusinessInfoRedirectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects legacy /book/[slug]/info URLs to canonical /business/[publicId]', async () => {
    mockResolvePublicBusinessIdOrNull.mockResolvedValue('CF-66W551');

    await expect(
      LegacyBusinessInfoRedirectPage({
        params: Promise.resolve({ slug: 'test-nail-salon' }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockResolvePublicBusinessIdOrNull).toHaveBeenCalledWith('test-nail-salon');
    expect(mockRedirect).toHaveBeenCalledWith('/business/CF-66W551');
  });

  it('returns notFound when slug does not resolve to a business', async () => {
    mockResolvePublicBusinessIdOrNull.mockResolvedValue(null);

    await expect(
      LegacyBusinessInfoRedirectPage({
        params: Promise.resolve({ slug: 'does-not-exist' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });
});
