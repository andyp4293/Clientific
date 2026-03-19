import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('service worker navigation contract', () => {
  it('falls back to a static offline document instead of cached auth redirects', () => {
    const source = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf8');

    expect(source).toContain("const OFFLINE_FALLBACK_URL = '/offline.html';");
    expect(source).toContain('const CACHE_NAME = \'clientific-v3\';');
    expect(source).not.toContain("'/dashboard'");
    expect(source).not.toContain("'/login'");
    expect(source).not.toContain("caches.match('/dashboard') || caches.match('/login')");
    expect(source).toContain("return new Response('Offline'");
  });
});
