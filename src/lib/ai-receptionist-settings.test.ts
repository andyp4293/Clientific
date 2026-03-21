import { describe, expect, it, vi } from 'vitest';
import {
  getAiReceptionistActivationStorageKey,
  getAiReceptionistSetupState,
  readAiReceptionistActivationUntil,
} from './ai-receptionist-settings';

describe('ai-receptionist-settings helpers', () => {
  it('treats sms fallback number as active setup state', () => {
    const state = getAiReceptionistSetupState(
      { vapiPhoneNumber: null, smsAiPhoneNumber: '+18557654989' },
      false
    );

    expect(state).toEqual({
      unifiedNumber: '+18557654989',
      state: 'active',
    });
  });

  it('returns error state only when no number exists and setup is not pending', () => {
    const state = getAiReceptionistSetupState(
      { vapiPhoneNumber: null, smsAiPhoneNumber: null },
      false
    );

    expect(state).toEqual({
      unifiedNumber: '',
      state: 'error',
    });
  });

  it('returns pending when AI is enabled and number is still provisioning', () => {
    const state = getAiReceptionistSetupState(
      { aiReceptionistEnabled: true, vapiPhoneNumber: null, smsAiPhoneNumber: null },
      false,
      false
    );

    expect(state).toEqual({
      unifiedNumber: '',
      state: 'pending',
    });
  });

  it('builds a stable storage key per business id', () => {
    expect(getAiReceptionistActivationStorageKey('biz-1')).toBe(
      'clientific.aiReceptionist.activationUntil.biz-1'
    );
    expect(getAiReceptionistActivationStorageKey('')).toBeNull();
  });

  it('restores valid persisted countdown and clears expired timestamps', () => {
    const storage = {
      getItem: vi
        .fn()
        .mockReturnValueOnce('2026-03-12T12:05:00.000Z')
        .mockReturnValueOnce('2026-03-12T11:58:00.000Z'),
      removeItem: vi.fn(),
    } as any;

    const active = readAiReceptionistActivationUntil(
      storage,
      'biz-1',
      Date.parse('2026-03-12T12:00:00.000Z')
    );
    const expired = readAiReceptionistActivationUntil(
      storage,
      'biz-1',
      Date.parse('2026-03-12T12:00:00.000Z')
    );

    expect(active?.toISOString()).toBe('2026-03-12T12:05:00.000Z');
    expect(expired).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith(
      'clientific.aiReceptionist.activationUntil.biz-1'
    );
  });
});
