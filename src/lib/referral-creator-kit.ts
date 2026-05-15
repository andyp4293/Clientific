import {
  REFERRAL_COMMISSION_DISPLAY,
  STANDARD_TRIAL_DAYS,
} from '@/lib/referral-config';

export const REFERRAL_CREATOR_PARTNER_PATH = '/partner';

function cleanOrigin(origin: string) {
  return origin.trim().replace(/\/+$/, '');
}

export function buildReferralCreatorPartnerUrl(origin: string) {
  return `${cleanOrigin(origin)}${REFERRAL_CREATOR_PARTNER_PATH}`;
}

export function buildReferralCreatorBrief(partnerUrl: string) {
  return [
    'Clientific creator referral program',
    '',
    `Creators can earn ${REFERRAL_COMMISSION_DISPLAY} recurring commission from every paid Clientific subscription invoice while the referred business stays subscribed.`,
    '',
    `1. Create a free referral partner account: ${partnerUrl}`,
    '2. Verify your email and finish secure Stripe payout setup.',
    '3. Open Dashboard > Referrals and copy your own unique referral link or fallback code.',
    '4. Promote Clientific to salons, spas, barbers, med spas, massage studios, and other service businesses.',
    '',
    'What to say:',
    '- Clientific helps service businesses stop missing bookings.',
    '- Owners get online booking, appointment reminders, customer CRM, deals, referrals, payouts, and optional AI receptionist phone coverage.',
    '- New businesses start with a 14-day trial before choosing a paid plan.',
    '',
    'Important: use your own referral link from your dashboard. That is what tracks the signup and recurring commission.',
  ].join('\n');
}

export function buildReferralCreatorCaption(partnerUrl: string) {
  return `Service business owners: stop missing bookings. Clientific gives you online booking, reminders, CRM, deals, payouts, and optional AI receptionist coverage. Start your ${STANDARD_TRIAL_DAYS}-day trial here: ${partnerUrl}`;
}

export function buildReferralCreatorEmailHref(partnerUrl: string) {
  const subject = 'Clientific creator referral program';
  const body = buildReferralCreatorBrief(partnerUrl);
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
