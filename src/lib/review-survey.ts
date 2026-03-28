import crypto from 'crypto';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';

export type ReviewSurveyTokenPayload = {
  v: 1;
  t: 'review';
  s: string;
  c: string;
  n?: string;
  e: number;
};

function getReviewSurveySecret(): string {
  return (
    process.env.REVIEW_SURVEY_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.TWILIO_AUTH_TOKEN ||
    'clientific-review-survey-dev-secret'
  );
}

function signPayload(encodedPayload: string): string {
  return crypto
    .createHmac('sha256', getReviewSurveySecret())
    .update(encodedPayload)
    .digest('base64url');
}

function isValidPayload(value: unknown): value is ReviewSurveyTokenPayload {
  if (!value || typeof value !== 'object') return false;

  const payload = value as Record<string, unknown>;
  return (
    payload.v === 1 &&
    payload.t === 'review' &&
    typeof payload.s === 'string' &&
    payload.s.length > 0 &&
    typeof payload.c === 'string' &&
    payload.c.length > 0 &&
    (payload.n === undefined || typeof payload.n === 'string') &&
    typeof payload.e === 'number' &&
    Number.isFinite(payload.e)
  );
}

export function createReviewSurveyToken(payload: Omit<ReviewSurveyTokenPayload, 'v' | 't'>): string {
  const normalizedPayload: ReviewSurveyTokenPayload = {
    v: 1,
    t: 'review',
    ...payload,
  };
  const encodedPayload = Buffer.from(JSON.stringify(normalizedPayload)).toString('base64url');
  const signature = signPayload(encodedPayload);

  return `rs1.${encodedPayload}.${signature}`;
}

export function parseReviewSurveyToken(
  token: string | null | undefined
): ReviewSurveyTokenPayload | null {
  if (typeof token !== 'string' || token.trim().length === 0) return null;

  const [version, encodedPayload, signature] = token.split('.');
  if (version !== 'rs1' || !encodedPayload || !signature) return null;

  const expectedSignature = signPayload(encodedPayload);
  try {
    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedSignature, 'utf8')
      )
    ) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!isValidPayload(payload)) return null;
    if (payload.e < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildReviewSurveyUrl(slug: string, token?: string | null): string {
  const baseUrl = getConfiguredAppBaseUrl();
  const surveyUrl = `${baseUrl}/feedback/${encodeURIComponent(slug)}`;

  if (!token) return surveyUrl;
  return `${surveyUrl}?token=${encodeURIComponent(token)}`;
}
