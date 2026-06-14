import { beforeEach, describe, expect, it, vi } from 'vitest';
import SignOutPage, { dynamic } from './page';

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

describe('page module smoke test', () => {
  beforeEach(() => {
    redirectMock.mockReset();
  });

  it('forces a dynamic server redirect through the cookie-clearing sign-out route', () => {
    expect(dynamic).toBe('force-dynamic');

    SignOutPage();

    expect(redirectMock).toHaveBeenCalledWith('/api/auth/force-signout?callbackUrl=/login');
  });
});
