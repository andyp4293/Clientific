import { describe, expect, it } from 'vitest';
import {
  getAiReceptionistSelectionPrompt,
  getAiReceptionistVoiceGreeting,
  getConversationClosing,
  getLanguageSelectionAcknowledgement,
  getTransferConfirmation,
  getTwilioGatherLanguage,
  getTwilioVoiceForLanguage,
  resolveAiReceptionistCallLanguage,
} from './ai-receptionist-language';

describe('ai-receptionist-language helpers', () => {
  it('uses a slower bilingual selector with the business name when spanish is enabled', () => {
    expect(getAiReceptionistVoiceGreeting('Clientific Studio', null, true)).toBe(
      getAiReceptionistSelectionPrompt('Clientific Studio'),
    );
    expect(getAiReceptionistVoiceGreeting('Clientific Studio', null, true)).toContain(
      'Hi, this is Clientific Studio.',
    );
    expect(getAiReceptionistVoiceGreeting('Clientific Studio', null, true)).toContain(
      'Hola, habla Clientific Studio.',
    );
    expect(getAiReceptionistVoiceGreeting('Clientific Studio', null, false)).not.toContain(
      getAiReceptionistSelectionPrompt('Clientific Studio'),
    );
  });

  it('resolves explicit digit language choices', () => {
    expect(resolveAiReceptionistCallLanguage({ digits: '1' })).toEqual({
      language: 'en',
      explicit: true,
      cleanedSpeech: '',
    });
    expect(resolveAiReceptionistCallLanguage({ digits: '2' })).toEqual({
      language: 'es',
      explicit: true,
      cleanedSpeech: '',
    });
  });

  it('resolves explicit spoken language choices and strips the selector phrase', () => {
    expect(
      resolveAiReceptionistCallLanguage({ speechResult: 'Spanish please, I need an appointment' }),
    ).toEqual({
      language: 'es',
      explicit: true,
      cleanedSpeech: 'I need an appointment',
    });

    expect(
      resolveAiReceptionistCallLanguage({ speechResult: 'English please, I need a haircut' }),
    ).toEqual({
      language: 'en',
      explicit: true,
      cleanedSpeech: 'I need a haircut',
    });
  });

  it('infers spanish from common spanish phrases when the caller skips the selector word', () => {
    expect(
      resolveAiReceptionistCallLanguage({ speechResult: 'Hola, necesito una cita para hoy' }),
    ).toEqual({
      language: 'es',
      explicit: false,
      cleanedSpeech: 'Hola, necesito una cita para hoy',
    });
  });

  it('defaults to english for unclassified speech', () => {
    expect(
      resolveAiReceptionistCallLanguage({ speechResult: 'I need an appointment tomorrow afternoon' }),
    ).toEqual({
      language: 'en',
      explicit: false,
      cleanedSpeech: 'I need an appointment tomorrow afternoon',
    });
  });

  it('returns the correct voices, gather languages, and canned prompts', () => {
    expect(getTwilioVoiceForLanguage('en')).toBe('Polly.Joanna');
    expect(getTwilioVoiceForLanguage('es')).toBe('Polly.Lupe');
    expect(getTwilioGatherLanguage('en')).toBe('en-US');
    expect(getTwilioGatherLanguage('es')).toBe('es-US');
    expect(getLanguageSelectionAcknowledgement('es')).toContain('espanol');
    expect(getTransferConfirmation('es')).toContain('le conecto');
    expect(getConversationClosing('es')).toContain('Adios');
  });
});
