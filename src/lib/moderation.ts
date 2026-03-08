export type ModerationAction = 'allow' | 'block';

export interface ModerationResult {
  action: ModerationAction;
  reasons: string[];
}

export interface ModerationFieldInput {
  label: string;
  value: unknown;
}

const PROFANITY_PATTERNS = [
  /\bfuck(?:ing|er|ed|s)?\b/i,
  /\bshit(?:ty|head|s)?\b/i,
  /\basshole\b/i,
  /\bbitch(?:es)?\b/i,
];

const SEXUAL_CONTENT_PATTERNS = [
  /\b(?:porn|porno|xxx)\b/i,
  /\b(?:nude|nudes|naked)\b/i,
  /\b(?:blowjob|handjob|oral sex)\b/i,
  /\b(?:dick|cock|pussy|boobs?|tits?)\b/i,
];

export function moderateText(text: string): ModerationResult {
  if (!text || typeof text !== 'string') {
    return { action: 'allow', reasons: [] };
  }

  const reasons: string[] = [];

  if (PROFANITY_PATTERNS.some((pattern) => pattern.test(text))) {
    reasons.push('profanity');
  }

  if (SEXUAL_CONTENT_PATTERNS.some((pattern) => pattern.test(text))) {
    reasons.push('sexual_content');
  }

  if (reasons.length > 0) {
    return { action: 'block', reasons };
  }

  return { action: 'allow', reasons: [] };
}

export function blockedContentError(fieldLabel: string): string {
  return `${fieldLabel} contains disallowed content. Please remove profanity or sexual content and try again.`;
}

export function getBlockedFieldLabel(fields: ModerationFieldInput[]): string | null {
  for (const field of fields) {
    if (typeof field.value !== 'string') {
      continue;
    }
    const text = field.value.trim();
    if (!text) {
      continue;
    }
    if (moderateText(text).action === 'block') {
      return field.label;
    }
  }
  return null;
}
