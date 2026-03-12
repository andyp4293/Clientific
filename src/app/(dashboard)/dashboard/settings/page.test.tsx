import { describe, it, expect } from 'vitest';
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
});
