import { describe, expect, it, vi } from 'vitest';

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

import BookIndexPage from './page';

describe('BookIndexPage', () => {
  it('redirects /book to /explore for customer intent', () => {
    expect(() => BookIndexPage()).toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/explore');
  });
});
