import { describe, expect, it } from 'vitest';
import {
  createAppointmentBatchToken,
  parseAppointmentBatchToken,
} from './appointment-confirmation-batches';

describe('appointment confirmation batch tokens', () => {
  it('round-trips a valid token payload', () => {
    const token = createAppointmentBatchToken({
      b: 'biz_123',
      p: '5551234567',
      s: 1_775_000_000_000,
      e: 1_775_000_060_000,
    });

    expect(parseAppointmentBatchToken(token)).toEqual({
      v: 1,
      t: 'ai',
      b: 'biz_123',
      p: '5551234567',
      s: 1_775_000_000_000,
      e: 1_775_000_060_000,
    });
  });

  it('rejects a tampered token', () => {
    const token = createAppointmentBatchToken({
      b: 'biz_123',
      p: '5551234567',
      s: 1_775_000_000_000,
      e: 1_775_000_060_000,
    });

    expect(parseAppointmentBatchToken(`${token}tampered`)).toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(parseAppointmentBatchToken('')).toBeNull();
    expect(parseAppointmentBatchToken('not-a-token')).toBeNull();
  });
});
