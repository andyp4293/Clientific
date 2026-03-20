'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { APP_DOMAIN, APP_NAME } from '@/lib/brand';
import { getPublicPlanSlug } from '@/lib/plan-utils';
import { PRICING_PLANS, VISIBLE_SELF_SERVE_PLAN_KEYS } from '@/lib/pricing-plans';
import { PublicSiteHeader } from '@/components/layout/PublicSiteHeader';

const faqs = [
  {
    q: 'How does the AI receptionist work?',
    a: `${APP_NAME} connects an AI-powered phone assistant to your business number. When a customer calls, the AI picks up, answers questions about your services and hours, and books appointments directly - all without you lifting a finger.`,
  },
  {
    q: 'How long is the free trial?',
    a: 'Your free trial lasts 14 days with full access to all features. No credit card required to start.',
  },
  {
    q: 'Do my customers need an account to book?',
    a: 'No. Customers book through your public booking link or by calling your number - no app or account needed on their end.',
  },
  {
    q: `What types of businesses is ${APP_NAME} for?`,
    a: 'Any service-based business - barbershops, salons, spas, nail studios, auto detailers, pet groomers, and more.',
  },
  {
    q: 'How do SMS reminders work?',
    a: `After a booking is made (online or via AI call), ${APP_NAME} automatically sends a confirmation text and a reminder before the appointment. No manual follow-up needed.`,
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. No long-term contracts or cancellation fees - cancel anytime from your billing settings.',
  },
];

const features = [
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    ),
    title: 'AI Phone Receptionist',
    desc: 'An AI assistant answers your business calls 24/7, books appointments, and answers customer questions automatically in your name.',
  },
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    ),
    title: 'Online Booking',
    desc: 'Customers book 24/7 through your branded page. Automated confirmations and reminders reduce no-shows.',
  },
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    ),
    title: 'Customer Intelligence',
    desc: `Full client history - visits, spending, and notes. ${APP_NAME} automatically segments customers into actionable groups.`,
  },
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    ),
    title: 'SMS Automation',
    desc: "Booking confirmations, appointment reminders, and review requests - all sent automatically to your customers' phones.",
  },
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    ),
    title: 'Analytics and Insights',
    desc: 'Track revenue trends, busiest days, top services, and customer segments so you can make better decisions with real data.',
  },
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    ),
    title: 'Walk-In Check-In',
    desc: 'Digital check-in for walk-in customers. Track visits and spending without paper or manual entry.',
  },
];

const quickStats = [
  { val: '24/7', label: 'AI answers your calls' },
  { val: '< 3 min', label: 'Average setup time' },
  { val: '99.9%', label: 'Platform uptime' },
  { val: '$0', label: 'To start your trial' },
];

const heroHighlights = [
  'AI receptionist answers missed calls',
  'Online booking stays open 24/7',
  'SMS reminders go out automatically',
];

const dashboardStats = [
  { label: "Today's appointments", val: '8', tone: 'border-primary/25 bg-primary/12 text-primary-200' },
  { label: 'Customers', val: '247', tone: 'border-primary/20 bg-primary/10 text-primary-300' },
  { label: 'AI calls', val: '12', tone: 'border-primary/30 bg-primary/15 text-primary-100' },
];

const todaySchedule = [
  { name: 'Alex M.', time: '9:00 AM', service: 'Haircut and beard', source: 'AI' },
  { name: 'Sarah K.', time: '10:30 AM', service: 'Highlights', source: 'Online' },
  { name: 'James R.', time: '12:00 PM', service: 'Trim and style', source: 'AI' },
];
const trustBadges = [
  {
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    label: 'SSL secured',
  },
  {
    icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
    label: 'Secure payments',
  },
  {
    icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
    label: 'Cancel anytime',
  },
  {
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    label: 'Reliable uptime',
  },
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
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
          <a href="#features" className="whitespace-nowrap rounded-full border border-gray-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-white dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-200 dark:hover:bg-gray-900">
            Platform
          </a>
          <a href="#pricing" className="whitespace-nowrap rounded-full border border-gray-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-white dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-200 dark:hover:bg-gray-900">
            Pricing
          </a>
          <a href="#faq" className="whitespace-nowrap rounded-full border border-gray-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-white dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-200 dark:hover:bg-gray-900">
            FAQ
          </a>
          <Link href="/explore" className="whitespace-nowrap rounded-full border border-gray-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-white dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-200 dark:hover:bg-gray-900">
            Book Services
          </Link>
        </div>
      </div>

      <section
        data-testid="homepage-hero"
        className="relative overflow-hidden border-b border-gray-200/70 bg-gradient-to-br from-white via-primary-50/70 to-gray-100 dark:border-gray-900 dark:from-gray-950 dark:via-gray-950 dark:to-primary-950"
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
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/80 px-4 py-1.5 text-xs font-semibold tracking-wide text-primary-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-primary-300">
                <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" />
                AI-powered platform for service businesses
              </div>
              <h1 className="mb-7 text-5xl font-bold leading-[1.05] tracking-tight text-gray-950 dark:text-white sm:text-6xl lg:text-7xl">
                Your business,
                <br />
                <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, rgb(var(--color-primary-500)) 0%, rgb(var(--color-primary-700)) 45%, rgb(var(--color-primary-400)) 100%)' }}>
                  on autopilot
                </span>
              </h1>
              <p className="mb-10 max-w-lg text-lg font-light leading-relaxed text-gray-700 dark:text-gray-300 sm:text-xl">
                {APP_NAME} answers your calls, books appointments, sends reminders, and tracks every customer so you can focus on doing the work.
              </p>

              <div className="mb-8 rounded-3xl border border-gray-200/80 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">Choose your path</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Link href={isAuthenticated ? '/dashboard' : '/register'} aria-label="I run a business" className="rounded-2xl border border-primary/30 bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800 transition-colors hover:bg-primary-100 dark:border-primary/40 dark:bg-primary/15 dark:text-primary-100 dark:hover:bg-primary/25">
                    I run a business
                  </Link>
                  <Link href="/explore" aria-label="I'm looking to book" className="rounded-2xl border border-gray-200 bg-gray-100/90 px-4 py-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-200 dark:border-white/20 dark:bg-white/[0.03] dark:text-gray-100 dark:hover:bg-white/[0.08]">
                    I&apos;m looking to book
                  </Link>
                </div>
              </div>
              {isAuthenticated ? (
                <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-gray-900 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">
                  Go to Dashboard <ArrowRight />
                </Link>
              ) : (
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-primary-500"
                    style={{ boxShadow: '0 0 40px rgb(var(--color-primary-600) / 0.35)' }}
                  >
                    Start Free - 14 Days <ArrowRight />
                  </Link>
                  <div className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                    <CheckIcon className="text-primary" />
                    No credit card required
                  </div>
                </div>
              )}

              <div className="mt-10 flex flex-wrap gap-3">
                {heroHighlights.map((item) => (
                  <div key={item} className="inline-flex items-center gap-2 rounded-full border border-gray-200/80 bg-white/75 px-3 py-1.5 text-sm text-gray-800 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200">
                    <CheckIcon className="text-primary" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-12 hidden lg:block lg:mt-0">
              <div className="relative" style={{ perspective: '1000px' }}>
                <div className="pointer-events-none absolute -inset-8 rounded-3xl bg-primary/15 blur-3xl" />
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gray-950 shadow-2xl" style={{ transform: 'rotateY(-4deg) rotateX(2deg)' }}>
                  <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="h-3 w-3 rounded-full bg-red-500/70" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
                    <div className="h-3 w-3 rounded-full bg-primary-400/70" />
                    <div className="mx-4 flex h-5 flex-1 items-center rounded-md bg-white/5 px-3">
                      <div className="mr-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-300/80" />
                      <span className="font-mono text-[10px] text-white/55">{APP_DOMAIN}/dashboard</span>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <div className="mb-0.5 text-sm font-semibold text-white/90">Good morning, Jordan</div>
                        <div className="text-[11px] text-white/55">Friday, March 7 - 3 appointments today</div>
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                        <span className="text-xs font-bold text-white">J</span>
                      </div>
                    </div>

                    <div className="mb-5 grid grid-cols-3 gap-3">
                      {dashboardStats.map((stat) => (
                        <div key={stat.label} className={`rounded-xl border p-3 ${stat.tone}`}>
                          <div className="text-xl font-bold tabular-nums">{stat.val}</div>
                          <div className="mt-0.5 text-[10px] leading-tight text-white/60">{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    <div className="mb-2.5 flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/55">Today&apos;s schedule</p>
                      <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[9px] font-semibold text-primary-200">LIVE</span>
                    </div>

                    <div className="space-y-2">
                      {todaySchedule.map((appointment, index) => {
                        const featured = index === 0;

                        return (
                          <div key={appointment.name} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${featured ? 'border-primary/20 bg-primary/10' : 'border-white/5 bg-white/[0.04]'}`}>
                            <div className="flex items-center gap-2">
                              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${featured ? 'bg-primary/30' : 'bg-white/10'}`}>
                                <span className={`text-[10px] font-bold ${featured ? 'text-primary-200' : 'text-white/60'}`}>{appointment.name[0]}</span>
                              </div>
                              <div>
                                <div className="text-xs font-medium text-white/90">{appointment.name}</div>
                                <div className="text-[10px] text-white/55">{appointment.service}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${appointment.source === 'AI' ? 'bg-primary/20 text-primary-200' : 'bg-primary/12 text-primary-300'}`}>
                                {appointment.source}
                              </span>
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/75">{appointment.time}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-gray-200/70 bg-white/70 dark:border-gray-900 dark:bg-gray-950/50">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
            {quickStats.map((stat, index) => (
              <div key={stat.label} className={index > 0 ? 'md:border-l md:border-gray-200/70 dark:md:border-gray-900' : ''}>
                <div className="mb-1 text-3xl font-bold tabular-nums text-primary">{stat.val}</div>
                <div className="text-sm text-gray-700 dark:text-gray-300">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="bg-white/70 py-20 sm:py-28 dark:bg-gray-950/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <div className="mb-4 inline-block rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary dark:bg-primary/10">
              Features
            </div>
            <h2 className="mb-4 text-3xl font-bold text-gray-950 dark:text-gray-100 sm:text-4xl">Everything you need, all in one place</h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-700 dark:text-gray-300">
              Stop juggling multiple tools. {APP_NAME} brings your booking, customers, AI, and marketing together in one platform.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="group rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 dark:border-gray-800 dark:bg-gray-900/80 dark:hover:border-primary/40 dark:hover:shadow-primary/10">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-50 to-gray-100 transition-transform duration-200 group-hover:scale-110 dark:from-primary/20 dark:to-gray-800">
                  <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {feature.icon}
                  </svg>
                </div>
                <h3 className="mb-2 text-base font-semibold text-gray-950 dark:text-gray-100">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="how-it-works" className="bg-gray-50/80 py-20 sm:py-28 dark:bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <div className="mb-4 inline-block rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary dark:bg-primary/10">
              How It Works
            </div>
            <h2 className="mb-4 text-3xl font-bold text-gray-950 dark:text-gray-100 sm:text-4xl">Up and running in minutes</h2>
            <p className="text-lg text-gray-700 dark:text-gray-300">Three simple steps to put your business on autopilot.</p>
          </div>

          <div className="relative grid gap-12 md:grid-cols-3 md:gap-8">
            <div className="absolute left-[calc(16.67%+2.5rem)] right-[calc(16.67%+2.5rem)] top-10 hidden h-px bg-gradient-to-r from-primary/20 via-primary/50 to-primary/20 md:block" />
            {[
              {
                step: '1',
                title: 'Set up your profile',
                desc: 'Add your services, staff, hours, and business info. Your AI receptionist and booking page are ready in minutes.',
              },
              {
                step: '2',
                title: 'Share your booking link',
                desc: 'Drop your link on Instagram, Google, or your website. Customers can book online or call - your AI handles both.',
              },
              {
                step: '3',
                title: 'Let automation take over',
                desc: `${APP_NAME} books appointments, sends reminders, collects reviews, tracks customers, and reports on your growth automatically.`,
              },
            ].map((step) => (
              <div key={step.step} className="relative text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-700" style={{ boxShadow: '0 8px 32px rgb(var(--color-primary-600) / 0.3)' }}>
                  <span className="text-3xl font-bold text-white">{step.step}</span>
                </div>
                <h3 className="mb-3 text-lg font-semibold text-gray-950 dark:text-gray-100">{step.title}</h3>
                <p className="mx-auto max-w-xs text-sm leading-relaxed text-gray-700 dark:text-gray-300">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-white/70 py-20 sm:py-28 dark:bg-gray-950/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <div className="mb-4 inline-block rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary dark:bg-primary/10">
              Pricing
            </div>
            <h2 className="mb-4 text-3xl font-bold text-gray-950 dark:text-gray-100 sm:text-4xl">One clear subscription</h2>
            <p className="text-lg text-gray-700 dark:text-gray-300">Everything you need for one location, with a 14-day free trial.</p>
          </div>

          <div className="mx-auto grid max-w-3xl gap-6">
            {VISIBLE_SELF_SERVE_PLAN_KEYS.map((key) => {
              const plan = PRICING_PLANS[key];
              const planSlug = getPublicPlanSlug(key.toLowerCase());
              const cardClassName = 'relative flex flex-col rounded-2xl border border-primary/30 bg-gradient-to-br from-primary-50 via-white to-gray-100 p-8 shadow-lg shadow-primary/10 dark:border-primary/40 dark:from-gray-950 dark:via-gray-950 dark:to-primary-950';

              return (
                <div key={key} data-testid="homepage-featured-plan" className={cardClassName}>
                  <h3 className="mb-1 text-xl font-bold text-gray-950 dark:text-white">{plan.name}</h3>
                  <p className="mb-5 text-sm text-gray-700 dark:text-gray-300">{plan.summary}</p>
                  <div className="mb-7">
                    <span className="text-4xl font-bold text-gray-950 dark:text-white">${plan.price}</span>
                    <span className="text-base font-normal text-gray-700 dark:text-gray-300">/mo</span>
                  </div>
                  <ul className="mb-8 flex-1 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2.5 text-sm text-gray-800 dark:text-gray-200">
                        <CheckIcon />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {isAuthenticated ? (
                    <Link
                      href="/pricing"
                      className="w-full rounded-xl bg-primary py-3 text-center font-semibold text-white transition-colors hover:bg-primary-600"
                      style={{ boxShadow: '0 0 20px rgb(var(--color-primary-600) / 0.35)' }}
                    >
                      View Subscription
                    </Link>
                  ) : (
                    <Link
                      href={`/register?plan=${planSlug}`}
                      className="w-full rounded-xl bg-primary py-3 text-center font-semibold text-white transition-colors hover:bg-primary-600"
                      style={{ boxShadow: '0 0 20px rgb(var(--color-primary-600) / 0.35)' }}
                    >
                      Start Free Trial
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section id="faq" className="bg-gray-50/80 py-20 sm:py-28 dark:bg-gray-900/50">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <div className="mb-4 inline-block rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary dark:bg-primary/10">
              FAQ
            </div>
            <h2 className="text-3xl font-bold text-gray-950 dark:text-gray-100 sm:text-4xl">Frequently asked questions</h2>
          </div>

          <div className="space-y-2">
            {faqs.map((faq, index) => (
              <div key={faq.q} className="overflow-hidden rounded-xl border border-gray-200 bg-white/85 dark:border-gray-800 dark:bg-gray-900/80">
                <button
                  className="flex w-full items-center justify-between px-6 py-4 text-left font-medium text-gray-950 transition-colors hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800/50"
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                >
                  <span>{faq.q}</span>
                  <svg className={`ml-4 h-4 w-4 shrink-0 text-gray-700 transition-transform dark:text-gray-300 ${openFaq === index ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-4xl">Ready to put your business on autopilot?</h2>
          <p className="mb-9 text-lg text-gray-700 dark:text-gray-300">Start your free 14-day trial. No credit card required.</p>
          {isAuthenticated ? (
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-8 py-3.5 font-semibold text-white transition-colors hover:bg-gray-900 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">
              Go to Dashboard <ArrowRight />
            </Link>
          ) : (
            <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-8 py-3.5 font-semibold text-white transition-colors hover:bg-gray-900 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">
              Get Started Free <ArrowRight />
            </Link>
          )}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
            {trustBadges.map((badge) => (
              <div key={badge.label} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={badge.icon} />
                </svg>
                {badge.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200/70 bg-gray-50 dark:border-gray-900 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
            <div className="col-span-2 md:col-span-1">
              <div className="mb-4 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <span className="text-xl font-bold text-white">C</span>
                </div>
                <span className="text-xl font-bold text-gray-950 dark:text-gray-100">{APP_NAME}</span>
              </div>
              <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                The AI-powered platform for service businesses to manage bookings, customers, and growth.
              </p>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold text-gray-950 dark:text-gray-100">Product</h4>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li><a href="#features" className="transition-colors hover:text-gray-950 dark:hover:text-gray-100">Features</a></li>
                <li><Link href="/explore" className="transition-colors hover:text-gray-950 dark:hover:text-gray-100">Explore Deals</Link></li>
                <li><Link href="/partner" className="transition-colors hover:text-gray-950 dark:hover:text-gray-100">Refer and Earn</Link></li>
                <li><a href="#pricing" className="transition-colors hover:text-gray-950 dark:hover:text-gray-100">Pricing</a></li>
                <li><a href="#faq" className="transition-colors hover:text-gray-950 dark:hover:text-gray-100">FAQ</a></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold text-gray-950 dark:text-gray-100">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li><Link href="/privacy" className="transition-colors hover:text-gray-950 dark:hover:text-gray-100">Privacy Policy</Link></li>
                <li><Link href="/terms" className="transition-colors hover:text-gray-950 dark:hover:text-gray-100">Terms of Service</Link></li>
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
