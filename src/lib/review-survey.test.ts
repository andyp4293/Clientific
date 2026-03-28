import { describe, expect, it, vi } from 'vitest';
import {
  buildReviewSurveyUrl,
  createReviewSurveyToken,
  parseReviewSurveyToken,
} from './review-survey';

describe('review survey token helpers', () => {
  it('creates and parses a valid review survey token', () => {
    const expiresAt = Date.now() + 60_000;
    const token = createReviewSurveyToken({
      s: 'test-salon',
      c: 'cust-1',
      n: 'Jane',
      e: expiresAt,
    });

    expect(parseReviewSurveyToken(token)).toEqual({
      v: 1,
      t: 'review',
      s: 'test-salon',
      c: 'cust-1',
      n: 'Jane',
      e: expiresAt,
    });
  });

  it('rejects expired review survey tokens', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-28T12:00:00.000Z'));
    const token = createReviewSurveyToken({
      s: 'test-salon',
      c: 'cust-1',
      e: Date.now() - 1,
    });

    expect(parseReviewSurveyToken(token)).toBeNull();
    vi.useRealTimers();
  });

  it('builds survey URLs with or without a token', () => {
    const token = createReviewSurveyToken({
      s: 'test-salon',
      c: 'cust-1',
      e: Date.now() + 60_000,
    });

    expect(buildReviewSurveyUrl('test-salon')).toContain('/feedback/test-salon');
    expect(buildReviewSurveyUrl('test-salon', token)).toContain(
      `/feedback/test-salon?token=${encodeURIComponent(token)}`
    );
  });
});
