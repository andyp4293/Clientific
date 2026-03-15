import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextConfig = require('../../../next.config.js');

describe('next.config redirects', () => {
  it('exports a redirects function', () => {
    expect(typeof nextConfig.redirects).toBe('function');
  });

  it('does not redirect clientific.net to clientific.app', async () => {
    const redirects = await nextConfig.redirects();
    expect(redirects).not.toContainEqual(
      expect.objectContaining({
        has: [{ type: 'host', value: 'clientific.net' }],
      })
    );
  });

  it('redirects clientell.io to clientific.app', async () => {
    const redirects = await nextConfig.redirects();
    expect(redirects).toContainEqual(
      expect.objectContaining({
        has: [{ type: 'host', value: 'clientell.io' }],
        destination: 'https://clientific.app/:path*',
        permanent: true,
      })
    );
  });

  it('redirects www.clientell.io to clientific.app', async () => {
    const redirects = await nextConfig.redirects();
    expect(redirects).toContainEqual(
      expect.objectContaining({
        has: [{ type: 'host', value: 'www.clientell.io' }],
        destination: 'https://clientific.app/:path*',
        permanent: true,
      })
    );
  });

  it('sets security headers globally', async () => {
    const headers = await nextConfig.headers();
    expect(headers[0].source).toBe('/(.*)');
    expect(headers[0].headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'X-Content-Type-Options', value: 'nosniff' }),
        expect.objectContaining({
          key: 'Strict-Transport-Security',
          value: expect.stringContaining('max-age='),
        }),
      ])
    );
  });
});
