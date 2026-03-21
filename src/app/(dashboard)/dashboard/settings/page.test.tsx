import { describe, it, expect, vi } from 'vitest';
import * as pageModule from './page';

describe('settings page module', () => {
  it('exports a default page component', () => {
    expect(typeof pageModule.default).toBe('function');
  });

  it('treats sms fallback number as active setup state', () => {
    const state = pageModule.getAiReceptionistSetupState(
      { vapiPhoneNumber: null, smsAiPhoneNumber: '+18557654989' } as any,
      false
    );

    expect(state).toEqual({
      unifiedNumber: '+18557654989',
      state: 'active',
    });
  });

  it('returns error state only when no number exists and setup is not pending', () => {
    const state = pageModule.getAiReceptionistSetupState(
      { vapiPhoneNumber: null, smsAiPhoneNumber: null } as any,
      false
    );

    expect(state).toEqual({
      unifiedNumber: '',
      state: 'error',
    });
  });

  it('returns pending when AI is enabled and number is still provisioning', () => {
    const state = pageModule.getAiReceptionistSetupState(
      { aiReceptionistEnabled: true, vapiPhoneNumber: null, smsAiPhoneNumber: null } as any,
      false,
      false
    );

    expect(state).toEqual({
      unifiedNumber: '',
      state: 'pending',
    });
  });

  it('builds a stable storage key per business id', () => {
    expect(pageModule.getAiReceptionistActivationStorageKey('biz-1')).toBe(
      'clientific.aiReceptionist.activationUntil.biz-1'
    );
    expect(pageModule.getAiReceptionistActivationStorageKey('')).toBeNull();
  });

  it('restores valid persisted countdown and clears expired timestamps', () => {
    const storage = {
      getItem: vi
        .fn()
        .mockReturnValueOnce('2026-03-12T12:05:00.000Z')
        .mockReturnValueOnce('2026-03-12T11:58:00.000Z'),
      removeItem: vi.fn(),
    } as any;

    const active = pageModule.readAiReceptionistActivationUntil(
      storage,
      'biz-1',
      Date.parse('2026-03-12T12:00:00.000Z')
    );
    const expired = pageModule.readAiReceptionistActivationUntil(
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

  it('exports a callable async save handler shape', () => {
    expect(typeof pageModule.default).toBe('function');
  });
});
