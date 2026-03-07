import { vi } from 'vitest';

// Mock next/cache globally — unstable_cache and revalidateTag are used in
// production code but have no meaning in a Node test environment.
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: () => unknown) => fn),
}));
