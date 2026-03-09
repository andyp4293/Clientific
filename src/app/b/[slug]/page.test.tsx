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

import LegacyBusinessProfileRedirectPage from './page';

describe('LegacyBusinessProfileRedirectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects legacy /b/[slug] URLs to canonical /business/[publicId]', async () => {
    mockResolvePublicBusinessIdOrNull.mockResolvedValue('CF-66W551');

    await expect(
      LegacyBusinessProfileRedirectPage({
        params: Promise.resolve({ slug: 'test-nail-salon' }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockResolvePublicBusinessIdOrNull).toHaveBeenCalledWith('test-nail-salon');
    expect(mockRedirect).toHaveBeenCalledWith('/business/CF-66W551');
  });

  it('returns notFound when legacy slug cannot be resolved', async () => {
    mockResolvePublicBusinessIdOrNull.mockResolvedValue(null);

    await expect(
      LegacyBusinessProfileRedirectPage({
        params: Promise.resolve({ slug: 'does-not-exist' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });
});
