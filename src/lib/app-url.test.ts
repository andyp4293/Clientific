import { afterEach, describe, expect, it } from 'vitest';
import {
  getAppBaseUrlFromRequest,
  getConfiguredAppBaseUrl,
  getConfiguredWebhookBaseUrl,
  getWebhookBaseUrl,
  getWebhookBaseUrlFromRequest,
} from '@/lib/app-url';

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_APP_URL;

describe('app-url helpers', () => {
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_ENV;
    }
  });

  it.each([
    ['https://clientific.app', 'https://clientific.app'],
    ['https://clientific.app/', 'https://clientific.app'],
    [' https://clientific.app/ ', 'https://clientific.app'],
    ['https://staging.clientific.app/', 'https://staging.clientific.app'],
  ])('getConfiguredAppBaseUrl normalizes NEXT_PUBLIC_APP_URL=%s', (envValue, expected) => {
    process.env.NEXT_PUBLIC_APP_URL = envValue;
    expect(getConfiguredAppBaseUrl()).toBe(expected);
  });

  it('getConfiguredAppBaseUrl falls back to branded APP_URL when env is missing', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getConfiguredAppBaseUrl()).toBe('https://clientific.app');
  });

  it.each([
    ['https://clientific.app', 'https://www.clientific.app'],
    ['https://clientific.net/', 'https://www.clientific.net'],
    ['https://staging.clientific.app/', 'https://staging.clientific.app'],
    ['http://localhost:3000', 'http://localhost:3000'],
  ])('getWebhookBaseUrl normalizes provider callback host for %s', (url, expected) => {
    expect(getWebhookBaseUrl(url)).toBe(expected);
  });

  it.each([
    ['https://clientific.app', 'https://www.clientific.app'],
    ['https://clientific.net/', 'https://www.clientific.net'],
    ['https://staging.clientific.app/', 'https://staging.clientific.app'],
  ])('getConfiguredWebhookBaseUrl normalizes provider callback host for %s', (envValue, expected) => {
    process.env.NEXT_PUBLIC_APP_URL = envValue;
    expect(getConfiguredWebhookBaseUrl()).toBe(expected);
  });

  it.each([
    ['https://preview.clientific.app', 'https://preview.clientific.app'],
    ['https://preview.clientific.app/', 'https://preview.clientific.app'],
    [' https://preview.clientific.app/ ', 'https://preview.clientific.app'],
  ])('getAppBaseUrlFromRequest prefers env over request URL (%s)', (envValue, expected) => {
    process.env.NEXT_PUBLIC_APP_URL = envValue;
    expect(getAppBaseUrlFromRequest('https://example.com/foo')).toBe(expected);
  });

  it.each([
    ['https://clientific.app/api/public/explore/deals', 'https://clientific.app'],
    ['http://localhost:3000/dashboard/customers', 'http://localhost:3000'],
    ['https://www.clientific.app/book/demo?x=1', 'https://www.clientific.app'],
    ['https://subdomain.clientific.app:444/path', 'https://subdomain.clientific.app:444'],
  ])('getAppBaseUrlFromRequest uses request origin when env is unset (%s)', (requestUrl, expected) => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getAppBaseUrlFromRequest(requestUrl)).toBe(expected);
  });

  it.each([
    '',
    'not-a-url',
    '/relative/path',
    '://missing-scheme',
  ])('getAppBaseUrlFromRequest falls back to APP_URL for invalid request URL "%s"', (requestUrl) => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getAppBaseUrlFromRequest(requestUrl)).toBe('https://clientific.app');
  });

  it('accepts non-http protocols when URL parsing succeeds', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getAppBaseUrlFromRequest('ftp://example.com/path')).toBe('ftp://example.com');
  });

  it('getAppBaseUrlFromRequest falls back to APP_URL when both env and request URL are missing', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getAppBaseUrlFromRequest()).toBe('https://clientific.app');
  });

  it.each([
    ['https://clientific.app/api/webhooks/twilio-sms', 'https://www.clientific.app'],
    ['https://www.clientific.app/api/webhooks/twilio-sms', 'https://www.clientific.app'],
    ['http://localhost:3000/api/webhooks/twilio-sms', 'http://localhost:3000'],
  ])('getWebhookBaseUrlFromRequest keeps provider callbacks on a non-redirecting host (%s)', (requestUrl, expected) => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getWebhookBaseUrlFromRequest(requestUrl)).toBe(expected);
  });
});
