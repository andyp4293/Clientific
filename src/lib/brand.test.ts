import { describe, expect, it } from 'vitest';
import {
  APP_DOMAIN,
  APP_NAME,
  APP_SUPPORT_EMAIL,
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
});
