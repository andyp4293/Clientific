import { APP_URL } from '@/lib/clientific-brand';

const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{4,32}$/;

function normalizeReferralCode(value: string) {
  return value.trim().toUpperCase();
}

function tryParseReferralUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const looksLikeUrl =
    /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('?') ||
    trimmed.startsWith('register?') ||
    trimmed.startsWith('register/') ||
    trimmed.includes('ref=');

  if (!looksLikeUrl) {
    return null;
  }

  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
      return new URL(trimmed);
    }

    if (trimmed.startsWith('?')) {
      return new URL(`/register${trimmed}`, APP_URL);
    }

    if (trimmed.startsWith('/')) {
      return new URL(trimmed, APP_URL);
    }

    return new URL(`/${trimmed.replace(/^\/+/, '')}`, APP_URL);
  } catch {
    return null;
  }
}

export function buildReferralInviteUrl(referralCode: string) {
  const normalizedCode = normalizeReferralCode(referralCode);
  return `${APP_URL}/register?ref=${encodeURIComponent(normalizedCode)}`;
}

export function resolveReferralCodeInput(value: string): {
  referralCode?: string;
  error?: string;
} {
  const trimmed = value.trim();

  if (!trimmed) {
    return {};
  }

  const parsedUrl = tryParseReferralUrl(trimmed);
  if (parsedUrl) {
    const refParam = parsedUrl.searchParams.get('ref');
    if (!refParam) {
      return {
        error: "That invite link doesn't include a referral code. Enter the fallback code instead.",
      };
    }

    const normalizedFromUrl = normalizeReferralCode(refParam);
    if (!REFERRAL_CODE_PATTERN.test(normalizedFromUrl)) {
      return {
        error: 'That referral code looks invalid. Paste a full invite link or enter the code again.',
      };
    }

    return { referralCode: normalizedFromUrl };
  }

  const normalizedCode = normalizeReferralCode(trimmed);
  if (!REFERRAL_CODE_PATTERN.test(normalizedCode)) {
    return {
      error: 'Enter a valid referral code or paste a full invite link.',
    };
  }

  return { referralCode: normalizedCode };
}
