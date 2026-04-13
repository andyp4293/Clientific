import {
  buildReferralInviteUrl,
  resolveReferralCodeInput,
} from '@/lib/referral-links';

describe('referral-links', () => {
  it('builds the canonical referral invite url', () => {
    expect(buildReferralInviteUrl('abcd1234')).toBe(
      'https://www.clientific.app/register?ref=ABCD1234',
    );
  });

  it('accepts a plain referral code', () => {
    expect(resolveReferralCodeInput(' abcd1234 ')).toEqual({
      referralCode: 'ABCD1234',
    });
  });

  it('extracts the code from a full referral link', () => {
    expect(
      resolveReferralCodeInput('https://www.clientific.app/register?ref=abcd1234'),
    ).toEqual({
      referralCode: 'ABCD1234',
    });
  });

  it('extracts the code from a relative registration link', () => {
    expect(resolveReferralCodeInput('/register?ref=ABCD1234')).toEqual({
      referralCode: 'ABCD1234',
    });
  });

  it("rejects invite links that don't include a referral code", () => {
    expect(resolveReferralCodeInput('https://www.clientific.app/register')).toEqual({
      error:
        "That invite link doesn't include a referral code. Enter the fallback code instead.",
    });
  });

  it('rejects malformed raw values that are neither a link nor a valid code', () => {
    expect(resolveReferralCodeInput('my referral code is cool')).toEqual({
      error: 'Enter a valid referral code or paste a full invite link.',
    });
  });
});
