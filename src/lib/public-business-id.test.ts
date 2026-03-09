import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindUnique } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: mockFindUnique,
    },
  },
}));

import { isPublicBusinessId, resolvePublicBusinessIdOrNull } from './public-business-id';

describe('public business id helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recognizes public IDs regardless of input case', () => {
    expect(isPublicBusinessId('CF-66W551')).toBe(true);
    expect(isPublicBusinessId('cf-66w551')).toBe(true);
    expect(isPublicBusinessId('test-nail-salon')).toBe(false);
  });

  it('resolves and normalizes public ID input', async () => {
    mockFindUnique.mockResolvedValue({ publicId: 'CF-66W551' });

    const publicId = await resolvePublicBusinessIdOrNull('cf-66w551');

    expect(publicId).toBe('CF-66W551');
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { publicId: 'CF-66W551' },
      select: { publicId: true },
    });
  });

  it('resolves by slug when input is not a public ID', async () => {
    mockFindUnique.mockResolvedValue({ publicId: 'CF-66W551' });

    const publicId = await resolvePublicBusinessIdOrNull('test-nail-salon');

    expect(publicId).toBe('CF-66W551');
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { slug: 'test-nail-salon' },
      select: { publicId: true },
    });
  });
});
