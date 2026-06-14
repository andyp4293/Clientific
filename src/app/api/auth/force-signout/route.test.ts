import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';

function makeRequest(path: string) {
  return new NextRequest(`https://www.clientific.app${path}`);
}

describe('/api/auth/force-signout', () => {
  it('clears auth cookies and redirects to the requested same-origin path', () => {
    const response = GET(
      makeRequest('/api/auth/force-signout?callbackUrl=/login?from=signout'),
    );
    const setCookie = response.headers.get('set-cookie') || '';

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'https://www.clientific.app/login?from=signout',
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(setCookie).toContain('next-auth.session-token=');
    expect(setCookie).toContain('__Secure-next-auth.session-token=');
    expect(setCookie).toContain('__Host-next-auth.csrf-token=');
    expect(setCookie).toContain('Max-Age=0');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=lax');
    expect(setCookie).toContain('Secure');
  });

  it('defaults to the login page when no callback URL is provided', () => {
    const response = GET(makeRequest('/api/auth/force-signout'));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://www.clientific.app/login');
  });

  it('allows same-origin absolute callback URLs', () => {
    const response = GET(
      makeRequest(
        '/api/auth/force-signout?callbackUrl=https%3A%2F%2Fwww.clientific.app%2Fstaff%2Fappointments',
      ),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'https://www.clientific.app/staff/appointments',
    );
  });

  it('falls back to login for cross-origin callback URLs', () => {
    const response = GET(
      makeRequest(
        '/api/auth/force-signout?callbackUrl=https%3A%2F%2Fevil.example%2Fsteal',
      ),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://www.clientific.app/login');
  });

  it('falls back to login for protocol-relative callback URLs', () => {
    const response = GET(
      makeRequest('/api/auth/force-signout?callbackUrl=%2F%2Fevil.example%2Fsteal'),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://www.clientific.app/login');
  });

  it('falls back to login for malformed callback URLs', () => {
    const response = GET(
      makeRequest('/api/auth/force-signout?callbackUrl=not%20a%20url'),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://www.clientific.app/login');
  });

  it('supports POST callers too', () => {
    const response = POST(
      makeRequest('/api/auth/force-signout?callbackUrl=/staff/set-password'),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'https://www.clientific.app/staff/set-password',
    );
  });
});
