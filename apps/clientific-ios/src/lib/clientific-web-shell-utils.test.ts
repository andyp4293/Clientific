import { describe, expect, it } from 'vitest';
import {
  getHostLabel,
  getPathLabel,
  isSupportedExternalScheme,
  isWebUrl,
} from './clientific-web-shell-utils';

describe('clientific web shell utils', () => {
  it('recognizes supported external schemes', () => {
    expect(isSupportedExternalScheme('mailto:support@clientific.app')).toBe(true);
    expect(isSupportedExternalScheme('tel:+15551234567')).toBe(true);
    expect(isSupportedExternalScheme('https://www.clientific.app')).toBe(false);
  });

  it('recognizes web urls', () => {
    expect(isWebUrl('https://www.clientific.app/dashboard')).toBe(true);
    expect(isWebUrl('http://localhost:3000')).toBe(true);
    expect(isWebUrl('clientific://dashboard')).toBe(false);
  });

  it('formats host and path labels for the native chrome', () => {
    expect(getHostLabel('https://www.clientific.app/dashboard/checkins')).toBe('clientific.app');
    expect(getPathLabel('https://www.clientific.app/')).toBe('Dashboard');
    expect(getPathLabel('https://www.clientific.app/dashboard/checkins')).toBe('/dashboard/checkins');
  });

  it('falls back safely for invalid urls', () => {
    expect(getHostLabel('not a url')).toBe('clientific.app');
    expect(getPathLabel('not a url')).toBe('Dashboard');
  });
});
