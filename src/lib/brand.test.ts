import { describe, expect, it } from 'vitest';
import {
  APP_DOMAIN,
  APP_NAME,
  APP_PRIVACY_PATH,
  APP_PRIVACY_URL,
  APP_SUPPORT_EMAIL,
  APP_SUPPORT_PATH,
  APP_SUPPORT_URL,
  APP_TERMS_PATH,
  APP_TERMS_URL,
  APP_URL,
} from '@/lib/brand';

describe('brand constants', () => {
  it('uses Clientific as app name', () => {
    expect(APP_NAME).toBe('Clientific');
  });

  it('uses clientific.app as canonical domain', () => {
    expect(APP_DOMAIN).toBe('clientific.app');
  });

  it('derives APP_URL from APP_DOMAIN', () => {
    expect(APP_URL).toBe('https://clientific.app');
  });

  it('uses canonical support email', () => {
    expect(APP_SUPPORT_EMAIL).toBe('support@clientific.app');
  });

  it('uses /support as the canonical support path', () => {
    expect(APP_SUPPORT_PATH).toBe('/support');
  });

  it('uses canonical legal paths', () => {
    expect(APP_PRIVACY_PATH).toBe('/privacy');
    expect(APP_TERMS_PATH).toBe('/terms');
  });

  it('derives canonical legal urls from APP_URL', () => {
    expect(APP_PRIVACY_URL).toBe('https://clientific.app/privacy');
    expect(APP_TERMS_URL).toBe('https://clientific.app/terms');
    expect(APP_SUPPORT_URL).toBe('https://clientific.app/support');
  });
});
