import { APP_URL } from '@/lib/clientific-brand';

const REFERRAL_COMMISSION_DISPLAY = '30%';
const STANDARD_TRIAL_DAYS = 14;

export const REFERRAL_CREATOR_PARTNER_URL = `${APP_URL}/partner`;

export function buildReferralCreatorBrief(businessName = 'Clientific') {
  return [
    'Clientific creator referral program',
    '',
    `${businessName} wanted to share this with you: creators can earn ${REFERRAL_COMMISSION_DISPLAY} recurring commission from every paid Clientific subscription invoice while the referred business stays subscribed.`,
    '',
    `1. Create a free referral partner account: ${REFERRAL_CREATOR_PARTNER_URL}`,
    '2. Verify your email and finish secure Stripe payout setup.',
    '3. Open Dashboard > Referrals and copy your own unique referral link or fallback code.',
    '4. Promote Clientific to salons, spas, barbers, med spas, massage studios, and other service businesses.',
    '',
    'What to say:',
    '- Clientific helps service businesses stop missing bookings.',
    '- Owners get online booking, appointment reminders, customer CRM, deals, referrals, payouts, and optional AI receptionist phone coverage.',
    `- New businesses start with a ${STANDARD_TRIAL_DAYS}-day trial before choosing a paid plan.`,
    '',
    'Important: use your own referral link from your dashboard. That is what tracks the signup and recurring commission.',
  ].join('\n');
}

export function buildReferralCreatorCaption() {
  return `Service business owners: stop missing bookings. Clientific gives you online booking, reminders, CRM, deals, payouts, and optional AI receptionist coverage. Start your ${STANDARD_TRIAL_DAYS}-day trial here: ${REFERRAL_CREATOR_PARTNER_URL}`;
}
