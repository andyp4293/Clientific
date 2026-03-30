import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/business-auth', () => ({
  authenticateBusinessCredentials: vi.fn(),
  BusinessAuthError: class BusinessAuthError extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly status: number,
    ) {
      super(message);
    }
  },
}));
vi.mock('@/lib/mobile-session', () => ({
  createMobileSessionToken: vi.fn(),
}));

import {
  authenticateBusinessCredentials,
  BusinessAuthError,
} from '@/lib/business-auth';
import { createMobileSessionToken } from '@/lib/mobile-session';
import { POST } from './route';

const mockAuthenticateBusinessCredentials =
  authenticateBusinessCredentials as ReturnType<typeof vi.fn>;
const mockCreateMobileSessionToken = createMobileSessionToken as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthenticateBusinessCredentials.mockResolvedValue({
    id: 'biz-1',
    businessId: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    onboardingComplete: true,
  });
  mockCreateMobileSessionToken.mockResolvedValue('mobile-token');
});

describe('POST /api/mobile/auth/login', () => {
  it('returns a mobile session token on successful sign in', async () => {
    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'owner@clientific.app', password: 'secret' }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.token).toBe('mobile-token');
    expect(body.business.name).toBe('Clientific Studio');
  });

  it('returns the shared auth error status when credentials fail', async () => {
    mockAuthenticateBusinessCredentials.mockRejectedValue(
      new BusinessAuthError('Email or password is incorrect', 'INVALID_CREDENTIALS', 401),
    );

    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'owner@clientific.app', password: 'bad' }),
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Email or password is incorrect' });
  });

  it('returns 400 when the request body is invalid json', async () => {
    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/auth/login', {
        method: 'POST',
        body: 'not-json',
      }),
    );

    expect(response.status).toBe(400);
  });
});
