import { describe, expect, it } from 'vitest';
import { getSessionBusinessId } from './session-business';

describe('getSessionBusinessId', () => {
  it('returns businessId when present', () => {
    const session = {
      user: {
        id: 'user-1',
        businessId: 'biz-1',
      },
    } as any;

    expect(getSessionBusinessId(session)).toBe('biz-1');
  });

  it('falls back to id when businessId is missing', () => {
    const session = {
      user: {
        id: 'biz-legacy',
      },
    } as any;

    expect(getSessionBusinessId(session)).toBe('biz-legacy');
  });

  it('returns null for blank values', () => {
    const session = {
      user: {
        id: '   ',
        businessId: '',
      },
    } as any;

    expect(getSessionBusinessId(session)).toBeNull();
  });

  it('returns null for empty session', () => {
    expect(getSessionBusinessId(null)).toBeNull();
    expect(getSessionBusinessId(undefined)).toBeNull();
  });
});

