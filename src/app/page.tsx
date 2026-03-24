'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { APP_DOMAIN, APP_NAME, APP_SUPPORT_EMAIL, APP_SUPPORT_PATH } from '@/lib/brand';
import { getPublicPlanSlug } from '@/lib/plan-utils';
import { PRICING_PLANS, VISIBLE_SELF_SERVE_PLAN_KEYS } from '@/lib/pricing-plans';
import { PublicSiteHeader } from '@/components/layout/PublicSiteHeader';

const faqs = [
  {
    q: 'How does the AI receptionist work?',
    a: `${APP_NAME} can provision and manage a dedicated AI receptionist number for your business. When AI calling is enabled, it can answer common questions, guide callers, and create bookings from your live availability.`,
  },
  {
    q: 'How long is the free trial?',
    a: 'Your free trial lasts 14 days with full access to the self-serve plan. No credit card is required to start.',
  },
  {
    q: 'Do my customers need an account to book?',
    a: 'No. Customers can book from your public booking page without creating a Clientific account.',
  },
  {
    q: `What types of businesses is ${APP_NAME} for?`,
    a: 'Clientific is built for service businesses that manage appointments, customer relationships, and repeat visits.',
  },
  {
    q: 'How do reminders and notifications work?',
    a: 'Clientific sends SMS confirmations and reminders to customers who opt in, and it can email the business when a new booking is created.',
  },
  {
    q: 'How do payouts work?',
    a: 'Paid deals and referral earnings move through secure Stripe payout setup. Once Stripe confirms the payout account, those funds are managed from the Payouts section.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. There are no long-term contracts, and billing can be managed from your account settings.',
  },
  {
    q: 'What is different between Starter, Pro, and Premium right now?',
    a: 'Right now the three launch plans share the same feature set and limits. The tier names and prices are live first, and plan packaging can be split out later without changing the workflow today.',
  },
];

const platformFacts = [
  {
    eyebrow: 'Trial',
    title: '14-day free trial',
    body: 'Start without entering a card, then decide if the workflow fits your business.',
  },
  {
    eyebrow: 'Pricing',
    title: 'Three launch prices',
    body: 'Starter, Pro, and Premium are all live now, and each tier currently includes the same core workflow.',
  },
  {
    eyebrow: 'Booking',
    title: 'No customer account required',
    body: 'Customers can book from a public page, and AI phone coverage can handle calls when enabled.',
  },
  {
    eyebrow: 'Payouts',
    title: 'Secure Stripe money movement',
    body: 'Paid deals and referral earnings route through Stripe-backed payout setup before going live.',
  },
];

const heroHighlights = [
  'Public booking page',
  'Optional AI receptionist setup',
  'Customer records and notes',
  'Deals, referrals, and payouts',
];

const platformAreas = [
  {
    tag: 'Booking',
    title: 'Appointments and availability',
    points: ['Public booking page', 'Services, staff, and hours', 'Confirmations and reminders'],
  },
  {
    tag: 'Customers',
    title: 'Relationship history',
    points: ['Profiles and visit history', 'Customer notes', 'Segments and follow-up'],
  },
  {
    tag: 'Growth',
    title: 'Deals, reviews, and referrals',
    points: ['Paid deals and claims', 'Review requests', 'Recurring referral program'],
  },
  {
    tag: 'Payouts',
    title: 'Secure money movement',
    points: ['Stripe payout setup', 'Paid deal payouts', 'Referral earnings in payouts'],
  },
];

const featureGroups = [
  {
    title: 'Online booking and calendar',
    description:
      'Publish a branded booking page, manage availability by service and staff, and keep appointment data inside one calendar workflow.',
    bullets: ['Public booking links', 'Service and staff selection', 'Appointment confirmations and reminders'],
  },
  {
    title: 'AI phone coverage',
    description:
      'Enable a dedicated AI receptionist line that can answer common questions and capture bookings using your live availability.',
    bullets: ['Dedicated AI number', 'Configurable greeting and FAQs', 'Booking flow tied to your schedule'],
  },
  {
    title: 'Customer records',
    description:
      'Track who has visited, what they booked, what they spent, and any notes your team needs to remember next time.',
    bullets: ['Visit history', 'Spending history', 'Customer notes and filters'],
  },
  {
    title: 'Deals and checkout',
    description:
      'Create paid or free deals, publish them publicly, and route eligible purchases through the deal checkout flow.',
    bullets: ['Purchase-link deals', 'Code-claim offers', 'Secure checkout and redemption'],
  },
  {
    title: 'Reviews and follow-up',
    description:
      'Prompt customers for reviews from the dashboard and keep communication flows tied to actual activity instead of separate tools.',
    bullets: ['Review request actions', 'Booking notifications', 'Customer communication context'],
  },
  {
    title: 'Payouts and referrals',
    description:
      'Handle business payouts and recurring referral earnings in the same payout workspace once secure setup is complete.',
    bullets: ['Stripe Connect onboarding', 'Paid deal payout controls', 'Recurring referral earnings'],
  },
];

const workflowSteps = [
  {
    step: '01',
    title: 'Set up your business profile',
    body: 'Add services, staff, business hours, booking preferences, and brand details from the dashboard.',
  },
  {
    step: '02',
    title: 'Capture bookings from web or phone',
    body: 'Customers can use your booking page, and AI phone coverage can take bookings when it is enabled.',
  },
  {
    step: '03',
    title: 'Run the day from one dashboard',
    body: 'Manage appointments, customer records, check-ins, reviews, and business settings without hopping between tools.',
  },
  {
    step: '04',
    title: 'Handle paid deals and payouts carefully',
    body: 'Complete secure Stripe payout setup before paid deals or referral sharing go live, then track earnings inside Payouts.',
  },
];

const closingNotes = [
  '14-day free trial',
  'Cancel anytime from billing',
  'No customer app required to book',
  `Questions? ${APP_SUPPORT_EMAIL}`,
];

const CheckIcon = ({ className = 'text-primary' }: { className?: string }) => (
  <svg className={`h-4 w-4 shrink-0 ${className}`} fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

const ArrowRight = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export default function HomePage() {
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const lowestMonthlyPrice = Math.min(
    ...VISIBLE_SELF_SERVE_PLAN_KEYS.map((key) => PRICING_PLANS[key].price)
  );

  return (
    <div className="page-shell min-h-screen">
      <PublicSiteHeader
        active="home"
        showLogin={!isAuthenticated}
        ctaLabel={isAuthenticated ? 'Dashboard' : 'Start Free Trial'}
        ctaHref={isAuthenticated ? '/dashboard' : '/register'}
      />

      <div className="border-b border-gray-200/80 bg-white/80 dark:border-gray-900 dark:bg-gray-950/80">
        <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
          <a
            href="#features"
            className="whitespace-nowrap rounded-full border border-gray-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-white dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-200 dark:hover:bg-gray-900"
          >
            Platform
          </a>
          <a
            href="#workflow"
            className="whitespace-nowrap rounded-full border border-gray-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-white dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-200 dark:hover:bg-gray-900"
          >
            Workflow
          </a>
          <a
            href="#pricing"
            className="whitespace-nowrap rounded-full border border-gray-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-white dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-200 dark:hover:bg-gray-900"
          >
            Pricing
          </a>
          <a
            href="#faq"
            className="whitespace-nowrap rounded-full border border-gray-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-white dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-200 dark:hover:bg-gray-900"
          >
            FAQ
          </a>
          <Link
            href="/explore"
            className="whitespace-nowrap rounded-full border border-gray-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-white dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-200 dark:hover:bg-gray-900"
          >
            Book Services
          </Link>
        </div>
      </div>

      <section
        data-testid="homepage-hero"
        className="home-hero-shell relative overflow-hidden border-b border-gray-200/70 dark:border-gray-900"
      >
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[800px] w-[1100px] -translate-x-1/2 rounded-full bg-primary/12 blur-[140px]" />
        <div className="pointer-events-none absolute top-1/2 -right-40 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[100px]" />
        <div className="pointer-events-none absolute top-1/2 -left-40 h-[400px] w-[400px] rounded-full bg-primary/8 blur-[100px]" />
        <div
          className="pointer-events-none absolute inset-0 dark:hidden"
          style={{
            backgroundImage: 'radial-gradient(rgba(6,17,24,0.06) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 hidden dark:block"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-gray-50 dark:from-gray-950 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8 lg:py-36">
          <div className="items-center lg:grid lg:grid-cols-2 lg:gap-20">
            <div>
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-gray-200/80 bg-white/72 px-4 py-1.5 text-xs font-semibold tracking-wide text-primary-700 shadow-sm dark:border-white/10 dark:bg-white/[0.06] dark:text-primary-300">
                <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                AI-powered platform for service businesses
              </div>
              <h1 className="mb-7 text-5xl font-bold leading-[1.05] tracking-tight text-gray-950 dark:text-white sm:text-6xl lg:text-7xl">
                Your business,
                <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      'linear-gradient(135deg, rgb(var(--color-primary-500)) 0%, rgb(var(--color-primary-700)) 45%, rgb(var(--color-primary-400)) 100%)',
                  }}
                >
                  on autopilot
                </span>
              </h1>
              <p className="mb-10 max-w-xl text-lg font-light leading-relaxed text-gray-700 dark:text-gray-300 sm:text-xl">
                {APP_NAME} helps service businesses manage appointments, customer records,
                AI phone coverage, paid deals, recurring referrals, and secure payouts from a
                single dashboard.
              </p>

              <div className="mb-8 rounded-[28px] border border-gray-200/80 bg-white/72 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                  Choose your path
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Link
                    href={isAuthenticated ? '/dashboard' : '/register'}
                    aria-label="I run a business"
                    className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary/15 dark:border-primary/30 dark:bg-primary/15 dark:text-primary-100 dark:hover:bg-primary/25"
                  >
                    I run a business
                  </Link>
                  <Link
                    href="/explore"
                    aria-label="I'm looking to book"
                    className="rounded-2xl border border-gray-200 bg-white/72 px-4 py-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-white dark:border-white/15 dark:bg-white/[0.03] dark:text-gray-100 dark:hover:bg-white/[0.08]"
                  >
                    I&apos;m looking to book
                  </Link>
                </div>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                {isAuthenticated ? (
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-gray-900 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                  >
                    Go to Dashboard <ArrowRight />
                  </Link>
                ) : (
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-primary-500"
                    style={{ boxShadow: '0 0 40px rgb(var(--color-primary-600) / 0.35)' }}
                  >
                    Start Free Trial <ArrowRight />
                  </Link>
                )}

                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white/72 px-6 py-4 text-base font-semibold text-gray-900 transition-colors hover:bg-white dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/[0.06]"
                >
                  View Pricing
                </Link>
              </div>

              <div className="mt-4 flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                <CheckIcon className="text-primary" />
                {isAuthenticated
                  ? 'Open the dashboard to manage appointments, customers, and payouts.'
                  : 'No credit card required to start the 14-day trial.'}
              </div>

              <div className="mt-10 flex flex-wrap gap-3">
                {heroHighlights.map((item) => (
                  <div
                    key={item}
                    className="home-hero-chip inline-flex items-center gap-2 text-sm text-gray-700 shadow-sm dark:text-gray-200"
                  >
                    <CheckIcon className="text-primary" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-12 hidden lg:block lg:mt-0">
              <div className="relative" style={{ perspective: '1000px' }}>
                <div className="pointer-events-none absolute -inset-8 rounded-3xl bg-primary/15 blur-3xl" />
                <div
                  data-testid="homepage-hero-panel"
                  className="home-hero-panel relative overflow-hidden shadow-2xl"
                  style={{ transform: 'rotateY(-4deg) rotateX(2deg)' }}
                >
                  <div className="flex items-center gap-2 border-b border-gray-200/80 bg-white/60 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
                    <div className="h-3 w-3 rounded-full bg-red-500/70" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
                    <div className="h-3 w-3 rounded-full bg-primary-400/70" />
                    <div className="mx-4 flex h-5 flex-1 items-center rounded-md bg-white/75 px-3 dark:bg-white/5">
                      <div className="mr-1.5 h-2 w-2 shrink-0 rounded-full bg-primary/80" />
                      <span className="font-mono text-[10px] text-gray-500 dark:text-white/55">
                        {APP_DOMAIN}/dashboard
                      </span>
                    </div>
                  </div>

                  <div className="border-b border-gray-200/80 px-5 py-5 dark:border-white/10">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-white/45">
                          Inside Clientific
                        </p>
                        <h2 className="mt-2 text-xl font-semibold text-gray-950 dark:text-white/95">
                          The workflow stays connected
                        </h2>
                      </div>
                      <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary-700 dark:text-primary-200">
                        Single dashboard
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 p-5 sm:grid-cols-2">
                    {platformAreas.map((area) => (
                      <div
                        key={area.title}
                        className="home-hero-card"
                      >
                        <div className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary-700 dark:text-primary-200">
                          {area.tag}
                        </div>
                        <h3 className="mt-3 text-sm font-semibold text-gray-950 dark:text-white/95">
                          {area.title}
                        </h3>
                        <ul className="mt-3 space-y-2">
                          {area.points.map((point) => (
                            <li key={point} className="flex items-start gap-2 text-xs leading-5 text-gray-700 dark:text-white/70">
                              <CheckIcon className="mt-0.5 text-primary-300" />
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-200/80 px-5 py-4 dark:border-white/10">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-white/45">
                      Main workspaces
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {['Dashboard', 'Appointments', 'Customers', 'Deals', 'Payouts', 'Referrals'].map(
                        (item) => (
                          <span
                            key={item}
                            className="home-hero-chip text-[11px] font-medium text-gray-700 dark:text-white/75"
                          >
                            {item}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-gray-200/70 bg-white/70 dark:border-gray-900 dark:bg-gray-950/50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
          <div
            data-testid="homepage-quick-stats"
            className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4"
          >
            {platformFacts.map((fact) => (
              <div
                key={fact.title}
                data-testid="homepage-quick-stat-card"
                className="rounded-2xl border border-gray-200/80 bg-white/88 px-5 py-5 text-left shadow-sm dark:border-gray-800 dark:bg-gray-900/78"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                  {fact.eyebrow}
                </div>
                <div className="mt-3 text-xl font-semibold text-gray-950 dark:text-white">
                  {fact.title}
                </div>
                <div className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
                  {fact.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="bg-white/70 py-20 sm:py-28 dark:bg-gray-950/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <div className="mb-4 inline-block rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary dark:bg-primary/10">
              Platform
            </div>
            <h2 className="mb-4 text-3xl font-bold text-gray-950 dark:text-gray-100 sm:text-4xl">
              What Clientific actually covers
            </h2>
            <p className="mx-auto max-w-3xl text-lg text-gray-700 dark:text-gray-300">
              The product is designed around real service-business workflows: booking,
              customer records, deals, reviews, referral earnings, and secure payouts.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {featureGroups.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-[28px] border border-gray-200 bg-white/85 p-6 shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 dark:border-gray-800 dark:bg-gray-900/80 dark:hover:border-primary/40 dark:hover:shadow-primary/10"
              >
                <div className="mb-4 inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                  Included
                </div>
                <h3 className="text-lg font-semibold text-gray-950 dark:text-gray-100">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-gray-700 dark:text-gray-300">
                  {feature.description}
                </p>
                <ul className="mt-5 space-y-2">
                  {feature.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-start gap-2 text-sm leading-6 text-gray-800 dark:text-gray-200"
                    >
                      <CheckIcon />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="bg-gray-50/80 py-20 sm:py-28 dark:bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <div className="mb-4 inline-block rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary dark:bg-primary/10">
              Workflow
            </div>
            <h2 className="mb-4 text-3xl font-bold text-gray-950 dark:text-gray-100 sm:text-4xl">
              How the workflow fits together
            </h2>
            <p className="mx-auto max-w-3xl text-lg text-gray-700 dark:text-gray-300">
              This is the straight version: set up the business, accept bookings, manage
              customers, and unlock payouts where payment flows require them.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {workflowSteps.map((item) => (
              <div
                key={item.step}
                className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-white">
                  {item.step}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-gray-950 dark:text-gray-100">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-gray-700 dark:text-gray-300">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-white/70 py-20 sm:py-28 dark:bg-gray-950/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="lg:sticky lg:top-24">
              <div className="mb-4 inline-block rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary dark:bg-primary/10">
                Pricing
              </div>
              <h2 className="text-3xl font-bold text-gray-950 dark:text-gray-100 sm:text-4xl">
                Regular pricing crossed out, launch pricing live
              </h2>
              <p className="mt-4 max-w-xl text-lg text-gray-700 dark:text-gray-300">
                Regularly priced up to $149/month. Today, Starter, Pro, and Premium start at
                ${lowestMonthlyPrice}/month while all three still unlock the same booking,
                customer management, growth tools, and payouts workflow.
              </p>
              <div className="mt-8 space-y-3">
                {platformFacts.map((fact) => (
                  <div
                    key={fact.title}
                    className="rounded-2xl border border-gray-200/80 bg-white/80 px-4 py-4 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-900/70"
                  >
                    <p className="font-semibold text-gray-950 dark:text-white">{fact.title}</p>
                    <p className="mt-1 leading-6 text-gray-700 dark:text-gray-300">{fact.body}</p>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-sm text-gray-700 dark:text-gray-300">
                Questions before you start?{' '}
                <Link href={APP_SUPPORT_PATH} className="text-primary hover:underline">
                  {APP_SUPPORT_EMAIL}
                </Link>
              </p>
            </div>

            <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
              {VISIBLE_SELF_SERVE_PLAN_KEYS.map((key) => {
                const plan = PRICING_PLANS[key];
                const planSlug = getPublicPlanSlug(key.toLowerCase());
                const monthlySavings = plan.compareAtPrice - plan.price;
                const yearlySavings = monthlySavings * 12;
                const discountPercent = Math.round((monthlySavings / plan.compareAtPrice) * 100);
                const cardClassName =
                  `relative flex flex-col rounded-[28px] border p-6 shadow-lg sm:p-8 ${
                    plan.popular
                      ? 'border-primary/30 bg-gradient-to-br from-primary-50 via-white to-gray-100 shadow-primary/10 dark:border-primary/40 dark:from-gray-950 dark:via-gray-950 dark:to-primary-950'
                      : 'border-gray-200 bg-white/85 dark:border-white/10 dark:bg-white/[0.03]'
                  }`;

                return (
                  <div
                    key={key}
                    data-testid="homepage-featured-plan"
                    className={cardClassName}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="mb-1 text-xl font-bold text-gray-950 dark:text-white">
                          {plan.name}
                        </h3>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{plan.summary}</p>
                      </div>
                      <div
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] ${
                          plan.popular
                            ? 'bg-primary text-white'
                            : 'border border-primary/20 bg-white/80 text-primary dark:border-primary/30 dark:bg-white/[0.08] dark:text-primary-200'
                        }`}
                      >
                        {plan.popular ? 'Most Popular' : 'Special Pricing'}
                      </div>
                    </div>

                    <div className="mb-7 mt-7">
                      <div className="rounded-2xl border border-gray-200/80 bg-white/75 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                          Regularly
                        </p>
                        <div className="mt-1 text-lg font-semibold text-gray-400 line-through decoration-2 dark:text-gray-500">
                          ${plan.compareAtPrice}/mo
                        </div>
                        <div className="mt-4 flex items-end gap-3">
                          <span className="rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white">
                            Today
                          </span>
                          <div>
                            <span className="text-5xl font-bold text-gray-950 dark:text-white">
                              ${plan.price}
                            </span>
                            <span className="text-base font-normal text-gray-700 dark:text-gray-300">
                              /mo
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-900/30 dark:bg-emerald-900/20">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                            Save
                          </p>
                          <p className="mt-1 font-semibold text-emerald-900 dark:text-emerald-100">${monthlySavings}/mo</p>
                        </div>
                        <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm dark:border-primary/30 dark:bg-primary/15">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary dark:text-primary-200">
                            Discount
                          </p>
                          <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{discountPercent}% off</p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm font-medium text-primary dark:text-primary-200">
                        That is ${yearlySavings}/year below the regular monthly rate.
                      </p>
                      <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                        Same feature access right now
                      </p>
                    </div>

                    <ul className="mb-8 flex-1 space-y-3">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2.5 text-sm leading-6 text-gray-800 dark:text-gray-200"
                        >
                          <CheckIcon />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {isAuthenticated ? (
                      <Link
                        href="/pricing"
                        className="w-full rounded-xl bg-primary py-3 text-center font-semibold text-white transition-colors hover:bg-primary-600"
                        style={{ boxShadow: '0 0 20px rgb(var(--color-primary-600) / 0.35)' }}
                      >
                        View Pricing
                      </Link>
                    ) : (
                      <Link
                        href={`/register?plan=${planSlug}`}
                        className="w-full rounded-xl bg-primary py-3.5 text-center font-semibold text-white transition-colors hover:bg-primary-600"
                        style={{ boxShadow: '0 0 20px rgb(var(--color-primary-600) / 0.35)' }}
                      >
                        Start {plan.name} Trial
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="bg-gray-50/80 py-20 sm:py-28 dark:bg-gray-900/50">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <div className="mb-4 inline-block rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary dark:bg-primary/10">
              FAQ
            </div>
            <h2 className="text-3xl font-bold text-gray-950 dark:text-gray-100 sm:text-4xl">
              Frequently asked questions
            </h2>
          </div>

          <div className="space-y-2">
            {faqs.map((faq, index) => (
              <div
                key={faq.q}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white/85 dark:border-gray-800 dark:bg-gray-900/80"
              >
                <button
                  className="flex w-full items-center justify-between px-6 py-4 text-left font-medium text-gray-950 transition-colors hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800/50"
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                >
                  <span>{faq.q}</span>
                  <svg
                    className={`ml-4 h-4 w-4 shrink-0 text-gray-700 transition-transform dark:text-gray-300 ${
                      openFaq === index ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === index && (
                  <div className="border-t border-gray-200 px-6 pb-5 pt-4 text-sm leading-relaxed text-gray-700 dark:border-gray-800 dark:text-gray-300">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        data-testid="homepage-cta"
        className="relative overflow-hidden border-y border-gray-200/70 bg-gradient-to-br from-primary-50 via-white to-gray-100 py-20 sm:py-28 dark:border-gray-900 dark:from-gray-950 dark:via-gray-950 dark:to-primary-950"
      >
        <div
          className="pointer-events-none absolute inset-0 dark:hidden"
          style={{
            backgroundImage: 'radial-gradient(rgba(6,17,24,0.05) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 hidden dark:block"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[100px]" />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-4xl">
            Run the business from one place
          </h2>
          <p className="mx-auto mb-9 max-w-2xl text-lg text-gray-700 dark:text-gray-300">
            Start with the booking flow, then layer in customer records, deals, review
            requests, referrals, and secure payouts as you need them.
          </p>
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-8 py-3.5 font-semibold text-white transition-colors hover:bg-gray-900 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              Go to Dashboard <ArrowRight />
            </Link>
          ) : (
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-8 py-3.5 font-semibold text-white transition-colors hover:bg-gray-900 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              Get Started Free <ArrowRight />
            </Link>
          )}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
            {closingNotes.map((note) =>
              note.includes('@') ? (
                <Link
                  key={note}
                  href={APP_SUPPORT_PATH}
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary dark:text-gray-300"
                >
                  <CheckIcon className="text-primary" />
                  {note}
                </Link>
              ) : (
                <div key={note} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <CheckIcon className="text-primary" />
                  {note}
                </div>
              )
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200/70 bg-gray-50 dark:border-gray-900 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div className="col-span-2 md:col-span-1">
              <div className="mb-4 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <span className="text-xl font-bold text-white">C</span>
                </div>
                <span className="text-xl font-bold text-gray-950 dark:text-gray-100">
                  {APP_NAME}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                Booking, customer follow-up, deals, referrals, and payouts for service
                businesses.
              </p>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold text-gray-950 dark:text-gray-100">
                Product
              </h4>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li>
                  <a
                    href="#features"
                    className="transition-colors hover:text-gray-950 dark:hover:text-gray-100"
                  >
                    Platform
                  </a>
                </li>
                <li>
                  <a
                    href="#workflow"
                    className="transition-colors hover:text-gray-950 dark:hover:text-gray-100"
                  >
                    Workflow
                  </a>
                </li>
                <li>
                  <Link
                    href="/pricing"
                    className="transition-colors hover:text-gray-950 dark:hover:text-gray-100"
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href="/partner"
                    className="transition-colors hover:text-gray-950 dark:hover:text-gray-100"
                  >
                    Refer and Earn
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold text-gray-950 dark:text-gray-100">
                Explore
              </h4>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li>
                  <Link
                    href="/explore"
                    className="transition-colors hover:text-gray-950 dark:hover:text-gray-100"
                  >
                    Browse Deals
                  </Link>
                </li>
                <li>
                  <a
                    href="#faq"
                    className="transition-colors hover:text-gray-950 dark:hover:text-gray-100"
                  >
                    FAQ
                  </a>
                </li>
                <li>
                  <Link
                    href={APP_SUPPORT_PATH}
                    className="transition-colors hover:text-gray-950 dark:hover:text-gray-100"
                  >
                    {APP_SUPPORT_EMAIL}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold text-gray-950 dark:text-gray-100">
                Legal
              </h4>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li>
                  <Link
                    href="/privacy"
                    className="transition-colors hover:text-gray-950 dark:hover:text-gray-100"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="transition-colors hover:text-gray-950 dark:hover:text-gray-100"
                  >
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-gray-200/70 pt-8 text-center text-sm text-gray-700 dark:border-gray-900 dark:text-gray-300">
            <span>Copyright 2026 {APP_NAME}. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
