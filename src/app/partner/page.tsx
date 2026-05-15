import Link from 'next/link';
import { PublicSiteHeader } from '@/components/layout/PublicSiteHeader';
import {
  REFERRAL_COMMISSION_DISPLAY,
  STANDARD_TRIAL_DAYS,
} from '@/lib/referral-config';

const highlights = [
  {
    title: 'Creator-ready tracking',
    body:
      'Use your own dashboard link or fallback code in every post, caption, bio link, story, or DM so each signup tracks back to you.',
  },
  {
    title: 'Free partner account',
    body:
      'Create a free Clientific partner account so you can finish payout setup and manage your referral link.',
  },
  {
    title: 'Recurring monthly earnings',
    body: `Earn ${REFERRAL_COMMISSION_DISPLAY} of every paid subscription invoice from the business you referred while they stay subscribed.`,
  },
  {
    title: 'Payouts through Stripe',
    body:
      'Finish secure Stripe payout setup first. After that, your referral earnings move through the same payouts flow shown in the dashboard.',
  },
];

const steps = [
  {
    num: '1',
    title: 'Create your free account',
    body: 'Start with a free partner account. No paid Clientific subscription is required.',
  },
  {
    num: '2',
    title: 'Finish payout setup',
    body:
      'Verify your email, sign in, and complete secure Stripe payout setup before sharing your referral link.',
  },
  {
    num: '3',
    title: 'Share your referral link',
    body:
      'Copy your link from the Referrals page once payouts are ready. The link stays locked until payout setup is complete.',
  },
  {
    num: '4',
    title: 'Earn every paid month',
    body: `After the business owner signs up and starts paying after their ${STANDARD_TRIAL_DAYS}-day trial, you earn ${REFERRAL_COMMISSION_DISPLAY} of each paid subscription invoice while they remain subscribed.`,
  },
];

export default function PartnerPage() {
  return (
    <div className="page-shell min-h-screen">
      <PublicSiteHeader active="partner" />

      <main className="mx-auto max-w-5xl px-4 py-12 md:py-20">
        <section className="overflow-hidden rounded-[32px] border border-gray-200 bg-gradient-to-br from-white via-white to-primary-50 px-6 py-10 shadow-sm dark:border-gray-800 dark:from-gray-950 dark:via-gray-950 dark:to-primary-950/30 md:px-10 md:py-14">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              Referral Program
            </div>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-gray-900 dark:text-white md:text-5xl">
              Earn {REFERRAL_COMMISSION_DISPLAY} every month a referred business pays
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600 dark:text-gray-300 md:text-lg">
              Built for content creators, salon consultants, local marketers, and business
              owners who want to promote Clientific. Create a free Clientific partner
              account, finish payout setup, and share your own referral link. No paid
              Clientific subscription is required to earn or collect payouts.
            </p>

            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
              Referral sharing unlocks only after Stripe payout setup is complete. That
              keeps earnings flowing into the payouts page correctly from day one.
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register?partner=1" className="btn-primary text-center">
                Create Free Referral Account
              </Link>
              <Link href="/login" className="btn-outline text-center">
                Log In To Referrals
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {highlights.map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {item.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400">
                {item.body}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:p-8">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                4
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                How the recurring referral flow works
              </h2>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {steps.map((item) => (
                <div
                  key={item.num}
                  className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-950/60"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {item.num}
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                Important
              </p>
              <h2 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">
                What this page is promising now
              </h2>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-gray-600 dark:text-gray-400">
                <li>No paid subscription is required for the referrer.</li>
                <li>
                  Earnings are recurring, not one-time, while the referred business keeps
                  paying.
                </li>
                <li>
                  Payout setup must be complete before the referral link can be shared.
                </li>
                <li>
                  The dashboard Referrals and Payouts pages are the source of truth after
                  signup.
                </li>
              </ul>
            </div>

            <div className="rounded-[28px] border border-primary/20 bg-primary-50 p-6 shadow-sm dark:border-primary/30 dark:bg-primary/10 md:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                Already have an account?
              </p>
              <h2 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">
                Jump straight to your referral tools
              </h2>
              <p className="mt-3 text-sm leading-6 text-gray-700 dark:text-gray-300">
                If you already have a Clientific login, go to the dashboard, finish payout
                setup, and open Referrals to copy your recurring link.
              </p>
              <div className="mt-5 flex flex-col gap-3">
                <Link href="/login" className="btn-primary text-center">
                  Log In
                </Link>
                <Link href="/register?partner=1" className="btn-outline text-center">
                  Create A Free Partner Account
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
