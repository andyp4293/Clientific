'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

const faqs = [
  {
    q: 'How does the AI receptionist work?',
    a: 'Clientell connects an AI-powered phone assistant to your business number. When a customer calls, the AI picks up, answers questions about your services and hours, and books appointments directly — all without you lifting a finger.',
  },
  {
    q: 'How long is the free trial?',
    a: 'Your free trial lasts 14 days with full access to all features. No credit card required to start.',
  },
  {
    q: 'Do my customers need an account to book?',
    a: 'No. Customers book through your public booking link or by calling your number — no app or account needed on their end.',
  },
  {
    q: 'What types of businesses is Clientell for?',
    a: 'Any service-based business — barbershops, salons, spas, nail studios, auto detailers, pet groomers, and more.',
  },
  {
    q: 'How do SMS reminders work?',
    a: 'After a booking is made (online or via AI call), Clientell automatically sends a confirmation text and a reminder before the appointment. No manual follow-up needed.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. No long-term contracts or cancellation fees — cancel anytime from your billing settings.',
  },
];

const features = [
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    ),
    title: 'AI Phone Receptionist',
    desc: 'An AI assistant answers your business calls 24/7, books appointments, and answers customer questions — automatically, in your name.',
  },
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    ),
    title: 'Online Booking',
    desc: 'Customers book 24/7 through your branded page. Automated confirmations and reminders drastically reduce no-shows.',
  },
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    ),
    title: 'Customer Intelligence',
    desc: 'Full client history — visits, spending, notes. Clientell automatically segments customers into VIP, Regular, At-Risk, and more.',
  },
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    ),
    title: 'SMS Automation',
    desc: 'Booking confirmations, appointment reminders, and review requests — all sent automatically to your customers\' phones.',
  },
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    ),
    title: 'Analytics & Insights',
    desc: 'Track revenue trends, busiest days, top services, and customer segments. Make smarter decisions with real data.',
  },
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    ),
    title: 'Walk-In Check-In',
    desc: 'Digital check-in for walk-in customers. Track visits and spending without any paper or manual entry.',
  },
];

const CheckIcon = () => (
  <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

const CheckIconLight = () => (
  <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

const ArrowRight = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export default function HomePage() {
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">

      {/* ── Header ── */}
      <header className="sticky top-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-xl">C</span>
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-gray-100">Clientell</span>
          </div>
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 text-sm font-medium transition-colors">Features</a>
            <a href="#how-it-works" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 text-sm font-medium transition-colors">How It Works</a>
            <a href="#pricing" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 text-sm font-medium transition-colors">Pricing</a>
            <a href="#faq" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 text-sm font-medium transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/dashboard" className="btn-primary text-sm px-4 py-2">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-medium text-sm hidden sm:block transition-colors">
                  Log In
                </Link>
                <Link href="/register" className="btn-primary text-sm px-4 py-2 whitespace-nowrap">
                  Start Free Trial
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[#030712]">
        {/* Glow orb */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[700px] rounded-full bg-primary/15 blur-[120px] pointer-events-none" />
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.055) 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white dark:from-gray-900 to-transparent pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36">
          <div className="lg:grid lg:grid-cols-2 lg:gap-16 items-center">

            {/* Copy */}
            <div>
              <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-blue-300 text-xs font-medium px-3.5 py-1.5 rounded-full mb-7">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block shrink-0" />
                AI-powered · Built for service businesses
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-[1.1] tracking-tight">
                Your business,<br />
                <span className="bg-gradient-to-r from-blue-400 via-primary to-indigo-400 bg-clip-text text-transparent">
                  on autopilot
                </span>
              </h1>
              <p className="text-lg text-gray-400 mb-9 max-w-lg leading-relaxed">
                Clientell answers your calls, books appointments, sends reminders, collects reviews, and tracks every customer — so you can focus on doing the work.
              </p>
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-primary-600 transition-all duration-200"
                  style={{ boxShadow: '0 0 32px rgba(59,130,246,0.45)' }}
                >
                  Go to Dashboard <ArrowRight />
                </Link>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-primary-600 transition-all duration-200"
                    style={{ boxShadow: '0 0 32px rgba(59,130,246,0.45)' }}
                  >
                    Start Free — 14 Days <ArrowRight />
                  </Link>
                  <p className="text-sm text-gray-500">No credit card required</p>
                </div>
              )}
            </div>

            {/* Dashboard mockup */}
            <div className="hidden lg:block mt-12 lg:mt-0">
              <div className="relative">
                <div className="absolute -inset-6 bg-primary/20 blur-3xl rounded-3xl pointer-events-none" />
                <div className="relative bg-gray-900 rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
                  {/* Browser chrome */}
                  <div className="bg-gray-800/80 border-b border-white/10 px-4 py-3 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
                    <div className="flex-1 mx-4 bg-gray-700/50 rounded-md h-5 flex items-center px-3">
                      <span className="text-[10px] text-gray-500">clientell.io/dashboard</span>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <div className="h-4 w-36 bg-gray-700 rounded-md mb-2" />
                        <div className="h-3 w-24 bg-gray-800 rounded-md" />
                      </div>
                      <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">J</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      {[
                        { label: "Today's Appts", val: '8', from: 'from-blue-500/20', border: 'border-blue-500/20', text: 'text-blue-300' },
                        { label: 'New Customers', val: '3', from: 'from-emerald-500/20', border: 'border-emerald-500/20', text: 'text-emerald-300' },
                        { label: 'AI Calls Today', val: '5', from: 'from-purple-500/20', border: 'border-purple-500/20', text: 'text-purple-300' },
                      ].map(stat => (
                        <div key={stat.label} className={`bg-gradient-to-br ${stat.from} to-transparent border ${stat.border} rounded-xl p-3`}>
                          <div className={`text-xl font-bold ${stat.text}`}>{stat.val}</div>
                          <div className="text-[10px] text-gray-400 leading-tight mt-0.5">{stat.label}</div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5">Today's Schedule</p>
                    <div className="space-y-2">
                      {[
                        { name: 'Alex M.', time: '9:00 AM', service: 'Haircut', source: 'AI' },
                        { name: 'Sarah K.', time: '10:30 AM', service: 'Highlights', source: 'Online' },
                        { name: 'James R.', time: '12:00 PM', service: 'Trim & Style', source: 'AI' },
                      ].map(appt => (
                        <div key={appt.name} className="flex items-center justify-between bg-gray-800/60 rounded-lg px-3 py-2 border border-white/5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center shrink-0">
                              <span className="text-primary text-[10px] font-bold">{appt.name[0]}</span>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-200">{appt.name}</div>
                              <div className="text-[10px] text-gray-500">{appt.service}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${appt.source === 'AI' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                              {appt.source}
                            </span>
                            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{appt.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Stats Strip ── */}
      <section className="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { val: '24/7', label: 'AI answers your calls' },
              { val: '< 3 min', label: 'Average setup time' },
              { val: '99.9%', label: 'Platform uptime' },
              { val: '$0', label: 'To start your trial' },
            ].map((stat, i) => (
              <div key={stat.label} className={i > 0 ? 'md:border-l md:border-gray-100 dark:md:border-gray-800' : ''}>
                <div className="text-3xl font-bold text-primary mb-1 tabular-nums">{stat.val}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="bg-white dark:bg-gray-900 py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block text-xs font-semibold text-primary bg-primary-50 dark:bg-primary/10 px-3 py-1 rounded-full mb-4 uppercase tracking-widest">
              Features
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">Everything you need, all in one place</h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Stop juggling multiple tools. Clientell brings your booking, customers, AI, and marketing together in one platform.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feat) => (
              <div
                key={feat.title}
                className="group bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 hover:border-primary/30 dark:hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 dark:hover:shadow-primary/10 transition-all duration-300"
              >
                <div className="w-11 h-11 bg-gradient-to-br from-primary-50 to-blue-100 dark:from-primary/20 dark:to-primary-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {feat.icon}
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">{feat.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="bg-gray-50 dark:bg-gray-800 py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block text-xs font-semibold text-primary bg-primary-50 dark:bg-primary/10 px-3 py-1 rounded-full mb-4 uppercase tracking-widest">
              How It Works
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">Up and running in minutes</h2>
            <p className="text-lg text-gray-500 dark:text-gray-400">Three simple steps to put your business on autopilot.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-12 md:gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-10 left-[calc(16.67%+2.5rem)] right-[calc(16.67%+2.5rem)] h-px bg-gradient-to-r from-primary/20 via-primary/50 to-primary/20" />
            {[
              {
                step: '1',
                title: 'Set up your profile',
                desc: 'Add your services, staff, hours, and business info. Your AI receptionist and booking page are ready in minutes.',
              },
              {
                step: '2',
                title: 'Share your booking link',
                desc: 'Drop your link on Instagram, Google, or your website. Customers can book online or just call — your AI handles both.',
              },
              {
                step: '3',
                title: 'Watch your business run itself',
                desc: 'Clientell books appointments, sends reminders, collects reviews, tracks customers, and reports on your growth — automatically.',
              },
            ].map(step => (
              <div key={step.step} className="text-center relative">
                <div
                  className="w-20 h-20 bg-gradient-to-br from-primary to-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-6"
                  style={{ boxShadow: '0 8px 32px rgba(59,130,246,0.3)' }}
                >
                  <span className="text-3xl font-bold text-white">{step.step}</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">{step.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto leading-relaxed text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="bg-white dark:bg-gray-900 py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block text-xs font-semibold text-primary bg-primary-50 dark:bg-primary/10 px-3 py-1 rounded-full mb-4 uppercase tracking-widest">
              Pricing
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">Simple, transparent pricing</h2>
            <p className="text-lg text-gray-500 dark:text-gray-400">Start free for 14 days. No credit card required.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">

            {/* Starter */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-8 flex flex-col bg-white dark:bg-gray-800">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">Starter</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Great for solo operators</p>
              <div className="mb-7">
                <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">$29</span>
                <span className="text-base text-gray-400 font-normal">/mo</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {['Up to 100 customers', '2 staff members', 'Online booking page', 'AI phone receptionist', 'SMS reminders', 'Walk-in check-in'].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-300">
                    <CheckIcon />{f}
                  </li>
                ))}
              </ul>
              {isAuthenticated ? (
                <Link href="/pricing" className="btn-outline w-full text-center">View Plans</Link>
              ) : (
                <Link href="/register?plan=starter" className="btn-outline w-full text-center">Start Free Trial</Link>
              )}
            </div>

            {/* Pro — dark featured card */}
            <div
              className="rounded-2xl p-8 flex flex-col relative bg-gray-950 border border-primary/40"
              style={{ boxShadow: '0 0 50px rgba(59,130,246,0.18)' }}
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-white px-4 py-1 rounded-full text-xs font-semibold shadow-lg" style={{ boxShadow: '0 2px 12px rgba(59,130,246,0.5)' }}>
                  Most Popular
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mb-1">Pro</h3>
              <p className="text-sm text-gray-400 mb-5">For growing businesses</p>
              <div className="mb-7">
                <span className="text-4xl font-bold text-white">$79</span>
                <span className="text-base text-gray-400 font-normal">/mo</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {['Up to 1,000 customers', '10 staff members', 'Everything in Starter', 'Analytics dashboard', 'Walk-in check-in', 'Priority support'].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-gray-300">
                    <CheckIconLight />{f}
                  </li>
                ))}
              </ul>
              {isAuthenticated ? (
                <Link href="/pricing" className="bg-primary text-white font-semibold text-center w-full py-3 rounded-xl hover:bg-primary-600 transition-colors" style={{ boxShadow: '0 0 20px rgba(59,130,246,0.35)' }}>
                  View Plans
                </Link>
              ) : (
                <Link href="/register?plan=pro" className="bg-primary text-white font-semibold text-center w-full py-3 rounded-xl hover:bg-primary-600 transition-colors" style={{ boxShadow: '0 0 20px rgba(59,130,246,0.35)' }}>
                  Start Free Trial
                </Link>
              )}
            </div>

            {/* Premium */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-8 flex flex-col bg-white dark:bg-gray-800">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">Premium</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">For multi-location businesses</p>
              <div className="mb-7">
                <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">$149</span>
                <span className="text-base text-gray-400 font-normal">/mo</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {['Unlimited customers', 'Unlimited staff', 'Everything in Pro', 'Advanced analytics', 'Custom integrations', 'Dedicated support'].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-300">
                    <CheckIcon />{f}
                  </li>
                ))}
              </ul>
              {isAuthenticated ? (
                <Link href="/pricing" className="btn-outline w-full text-center">View Plans</Link>
              ) : (
                <Link href="/register?plan=premium" className="btn-outline w-full text-center">Start Free Trial</Link>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="bg-gray-50 dark:bg-gray-800 py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="inline-block text-xs font-semibold text-primary bg-primary-50 dark:bg-primary/10 px-3 py-1 rounded-full mb-4 uppercase tracking-widest">
              FAQ
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">Frequently asked questions</h2>
          </div>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <button
                  className="w-full text-left px-6 py-4 flex items-center justify-between font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{faq.q}</span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ml-4 ${openFaq === i ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-gray-500 dark:text-gray-400 text-sm leading-relaxed border-t border-gray-50 dark:border-gray-800 pt-4">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden bg-[#030712] py-20 sm:py-28">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">Ready to put your business on autopilot?</h2>
          <p className="text-lg text-gray-400 mb-9">Start your free 14-day trial. No credit card required.</p>
          {isAuthenticated ? (
            <Link href="/dashboard" className="inline-flex items-center gap-2 bg-white text-gray-900 font-semibold px-8 py-3.5 rounded-xl hover:bg-gray-100 transition-colors">
              Go to Dashboard <ArrowRight />
            </Link>
          ) : (
            <Link href="/register" className="inline-flex items-center gap-2 bg-white text-gray-900 font-semibold px-8 py-3.5 rounded-xl hover:bg-gray-100 transition-colors">
              Get Started Free <ArrowRight />
            </Link>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl">C</span>
                </div>
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100">Clientell</span>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                The AI-powered platform for service businesses to manage bookings, customers, and growth.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 text-sm">Product</h4>
              <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <li><a href="#features" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Pricing</a></li>
                <li><a href="#faq" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 text-sm">Company</h4>
              <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <li><a href="#" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">About</a></li>
                <li><a href="#" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 text-sm">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <li><Link href="/privacy" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-100 dark:border-gray-800 mt-10 pt-8 text-center text-sm text-gray-400 dark:text-gray-500">
            © 2026 Clientell by Andy Pham. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  );
}
