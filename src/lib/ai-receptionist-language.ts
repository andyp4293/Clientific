export type AiReceptionistCallLanguage = 'en' | 'es';
export type AiReceptionistSelectionMode = 'dtmf' | 'spoken-digits' | 'speech-only';

type LanguageSelectionInput = {
  digits?: string | null;
  speechResult?: string | null;
};

type LanguageSelectionResult = {
  language: AiReceptionistCallLanguage;
  explicit: boolean;
  cleanedSpeech: string;
};

const ENGLISH_DTMF_SELECTION_PROMPT_TEMPLATE = (businessName: string) =>
  `Hi, this is ${businessName}. For English, press 1. Or say English.`;
const SPANISH_DTMF_SELECTION_PROMPT_TEMPLATE = (businessName: string) =>
  `Hola, habla ${businessName}. Para espanol, oprima 2. O diga espanol.`;
const ENGLISH_SPOKEN_DIGIT_SELECTION_PROMPT_TEMPLATE = (businessName: string) =>
  `Hi, this is ${businessName}. For English, say English. Or say one.`;
const SPANISH_SPOKEN_DIGIT_SELECTION_PROMPT_TEMPLATE = (businessName: string) =>
  `Hola, habla ${businessName}. Para espanol, diga espanol. O diga dos.`;
const ENGLISH_SPEECH_ONLY_SELECTION_PROMPT_TEMPLATE = (businessName: string) =>
  `Hi, this is ${businessName}. For English, say English.`;
const SPANISH_SPEECH_ONLY_SELECTION_PROMPT_TEMPLATE = (businessName: string) =>
  `Hola, habla ${businessName}. Para espanol, diga espanol.`;
const SPANISH_SELECTION_HINTS = 'English, Ingles, Spanish, Espanol';
const DEFAULT_ENGLISH_GREETING_TEMPLATE = (businessName: string) =>
  `Hi, thank you for calling ${businessName}. How can I help you today?`;

const ENGLISH_SELECTION_PATTERNS = [
  /\benglish\b/i,
  /\bingles\b/i,
  /\bin english\b/i,
  /\bone\b/i,
];

const SPANISH_SELECTION_PATTERNS = [
  /\bspanish\b/i,
  /\bespanol\b/i,
  /\bespañol\b/i,
  /\ben espanol\b/i,
  /\ben español\b/i,
  /\btwo\b/i,
  /\bdos\b/i,
];

const SPANISH_SIGNAL_PATTERNS = [
  /[áéíóúñ]/i,
  /\bhola\b/i,
  /\bbuen[oa]s?\b/i,
  /\bquiero\b/i,
  /\bnecesito\b/i,
  /\bcita\b/i,
  /\breservar\b/i,
  /\bhorario\b/i,
  /\bservicio\b/i,
  /\bgracias\b/i,
  /\bmanicura\b/i,
  /\bpedicura\b/i,
];

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeSelectionText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function stripLanguageSelectionPhrases(value: string): string {
  return collapseWhitespace(
    value
      .replace(/\bfor english\b/gi, ' ')
      .replace(/\bpress 1\b/gi, ' ')
      .replace(/\bsay one\b/gi, ' ')
      .replace(/\bone\b/gi, ' ')
      .replace(/\benglish please\b/gi, ' ')
      .replace(/\bingles por favor\b/gi, ' ')
      .replace(/\benglish\b/gi, ' ')
      .replace(/\bingles\b/gi, ' ')
      .replace(/\bpara espanol\b/gi, ' ')
      .replace(/\boprima 2\b/gi, ' ')
      .replace(/\bo diga dos\b/gi, ' ')
      .replace(/\bsay two\b/gi, ' ')
      .replace(/\btwo\b/gi, ' ')
      .replace(/\bdos\b/gi, ' ')
      .replace(/\bspanish please\b/gi, ' ')
      .replace(/\bespanol por favor\b/gi, ' ')
      .replace(/\bspanish\b/gi, ' ')
      .replace(/\bespanol\b/gi, ' ')
      .replace(/\bpor favor\b/gi, ' ')
      .replace(/\bplease\b/gi, ' ')
      .replace(/^[,.;:!?-]+\s*/g, ' ')
      .replace(/\s*[,.;:!?-]+\s*/g, ' '),
  );
}

export function getAiReceptionistSelectionPrompt(
  businessName: string,
  options?: { mode?: AiReceptionistSelectionMode },
): string {
  const mode = options?.mode ?? 'dtmf';

  if (mode === 'speech-only') {
    return `${ENGLISH_SPEECH_ONLY_SELECTION_PROMPT_TEMPLATE(
      businessName,
    )} ${SPANISH_SPEECH_ONLY_SELECTION_PROMPT_TEMPLATE(businessName)}`;
  }

  if (mode === 'spoken-digits') {
    return `${ENGLISH_SPOKEN_DIGIT_SELECTION_PROMPT_TEMPLATE(
      businessName,
    )} ${SPANISH_SPOKEN_DIGIT_SELECTION_PROMPT_TEMPLATE(businessName)}`;
  }

  return `${ENGLISH_DTMF_SELECTION_PROMPT_TEMPLATE(businessName)} ${SPANISH_DTMF_SELECTION_PROMPT_TEMPLATE(
    businessName,
  )}`;
}

export function getAiReceptionistSelectionReminder(
  options?: { mode?: AiReceptionistSelectionMode },
): string {
  const mode = options?.mode ?? 'dtmf';

  if (mode === 'speech-only') {
    return 'Take your time. For English, say English. Para espanol, diga espanol.';
  }

  if (mode === 'spoken-digits') {
    return 'Take your time. For English, say English, or say one. Para espanol, diga espanol, o diga dos.';
  }

  return 'Take your time. For English, press 1, or say English. Para espanol, oprima 2, o diga espanol.';
}

export function getAiReceptionistSelectionHints(): string {
  return SPANISH_SELECTION_HINTS;
}

export function getAiReceptionistVoiceGreeting(
  businessName: string,
  customGreeting: string | null | undefined,
  spanishEnabled: boolean,
  options?: { mode?: AiReceptionistSelectionMode },
): string {
  if (spanishEnabled) {
    return getAiReceptionistSelectionPrompt(businessName, options);
  }

  const baseGreeting = collapseWhitespace(
    customGreeting?.trim() || DEFAULT_ENGLISH_GREETING_TEMPLATE(businessName),
  );

  return baseGreeting;
}

export function getAiReceptionistVoicemailMessage(
  businessName: string,
  bookingUrl: string,
  spanishEnabled: boolean,
): string {
  if (!spanishEnabled) {
    return `Hi, you've reached ${businessName}. We missed your call — please call us back during business hours or book online at ${bookingUrl}.`;
  }

  return `Hi, you've reached ${businessName}. We missed your call. For English, please call us back during business hours or book online at ${bookingUrl}. Para espanol, llamenos durante horario laboral o reserve en linea en ${bookingUrl}.`;
}

export function getTwilioVoiceForLanguage(language: AiReceptionistCallLanguage): string {
  return language === 'es' ? 'Polly.Lupe' : 'Polly.Joanna';
}

export function getTwilioGatherLanguage(language: AiReceptionistCallLanguage): string {
  return language === 'es' ? 'es-US' : 'en-US';
}

export function getLanguageSelectionAcknowledgement(
  language: AiReceptionistCallLanguage,
): string {
  return language === 'es'
    ? 'Perfecto, seguire en espanol. En que puedo ayudarle hoy?'
    : "Perfect, I'll keep us in English. How can I help you today?";
}

export function getTransferConfirmation(
  language: AiReceptionistCallLanguage,
): string {
  return language === 'es'
    ? 'Claro, le conecto ahora. Un momento por favor.'
    : 'Sure, let me connect you with someone now. One moment please.';
}

export function getConversationClosing(
  language: AiReceptionistCallLanguage,
): string {
  return language === 'es'
    ? 'Hay algo mas en lo que pueda ayudarle? Adios.'
    : 'Is there anything else I can help you with? Goodbye!';
}

export function resolveAiReceptionistCallLanguage(
  input: LanguageSelectionInput,
): LanguageSelectionResult | null {
  const digits = input.digits?.trim();
  if (digits === '1') {
    return { language: 'en', explicit: true, cleanedSpeech: '' };
  }
  if (digits === '2') {
    return { language: 'es', explicit: true, cleanedSpeech: '' };
  }

  const rawSpeech = collapseWhitespace(input.speechResult?.trim() ?? '');
  if (!rawSpeech) {
    return null;
  }

  const normalizedSpeech = normalizeSelectionText(rawSpeech);
  const cleanedSpeech = stripLanguageSelectionPhrases(rawSpeech);

  if (ENGLISH_SELECTION_PATTERNS.some((pattern) => pattern.test(normalizedSpeech))) {
    return { language: 'en', explicit: true, cleanedSpeech };
  }

  if (SPANISH_SELECTION_PATTERNS.some((pattern) => pattern.test(normalizedSpeech))) {
    return { language: 'es', explicit: true, cleanedSpeech };
  }

  if (SPANISH_SIGNAL_PATTERNS.some((pattern) => pattern.test(rawSpeech))) {
    return { language: 'es', explicit: false, cleanedSpeech: rawSpeech };
  }

  return { language: 'en', explicit: false, cleanedSpeech: rawSpeech };
}
