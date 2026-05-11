import { describe, expect, it } from 'vitest';
import { sanitizeExternalHttpUrl, validateOptionalExternalHttpUrl } from './safe-url';

describe('sanitizeExternalHttpUrl', () => {
  it('keeps normalized http and https links', () => {
    expect(sanitizeExternalHttpUrl(' https://example.com/reviews ')).toBe(
      'https://example.com/reviews'
    );
    expect(sanitizeExternalHttpUrl('http://example.com/reviews')).toBe(
      'http://example.com/reviews'
    );
  });

  it('rejects executable and non-web schemes', () => {
    expect(sanitizeExternalHttpUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeExternalHttpUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(sanitizeExternalHttpUrl('/relative-path')).toBeNull();
  });
});

describe('validateOptionalExternalHttpUrl', () => {
  it('treats blank optional links as null', () => {
    expect(validateOptionalExternalHttpUrl('', 'Review URL')).toEqual({
      value: null,
      error: null,
    });
  });

  it('returns an error for unsafe optional links', () => {
    expect(validateOptionalExternalHttpUrl('javascript:alert(1)', 'Review URL')).toEqual({
      value: null,
      error: 'Review URL must be a valid http or https URL.',
    });
  });
});
