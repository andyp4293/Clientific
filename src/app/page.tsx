'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

const faqs = [
  {
    q: 'How long is the free trial?',
    a: 'Your free trial lasts 14 days with full access to all features. No credit card required to start.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes, you can cancel at any time. No long-term contracts or cancellation fees.',
  },
  {
    q: 'Do my customers need an account to book?',
    a: 'No. Customers book directly through your booking link — no account needed.',
  },
  {
    q: 'What types of businesses is ClientFlow for?',
    a: 'Any service-based business — barbershops, salons, spas, auto detailers, pet groomers, tutors, and more.',
  },
  {
    q: 'How do SMS reminders work?',
    a: 'ClientFlow sends automated appointment confirmations and reminders via SMS. Your monthly SMS limit depends on your plan.',
  },
];

const testimonials = [
  {
    text: 'ClientFlow completely changed how we run our barbershop. Customers book online, get reminders, and we hardly ever see no-shows anymore.',
    name: 'Marcus T.',
    business: 'Cut & Style Barbershop',
    initials: 'MT',
  },
  {
    text: 'The automated review requests alone are worth the price. Our Google reviews went from 12 to over 80 in just a few months.',
    name: 'Jessica L.',
    business: 'Serenity Nail Studio',
    initials: 'JL',
  },
  {
    text: 'I was running everything on paper before. Now I have a full client database, online booking, and I can see everything at a glance.',
    name: 'Carlos R.',
    business: 'Elite Auto Detailing',
    initials: 'CR',
  },
];

const features = [
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    ),
    title: 'Online Booking',
    desc: 'Customers book 24/7 through your branded page. Automated confirmations and reminders reduce no-shows.',
  },
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    ),
    title: 'Customer Tracking',
    desc: 'Full customer history — visits, spending, notes. Automatic VIP, Regular, and At-Risk segmentation.',
  },
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    ),
    title: 'Review Management',
    desc: 'Automatically request reviews after every visit. Route 5-star reviews to Google, handle feedback privately.',
  },
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    ),
    title: 'SMS Reminders',
    desc: 'Reduce no-shows with automated appointment reminders sent directly to your customers\' phones.',
  },
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    ),
    title: 'Walk-In Check-In',
    desc: 'Digital check-in for walk-in customers. Clean queue management, no paper needed.',
  },
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    ),
    title: 'Business Insights',
    desc: 'See your busiest days, top services, and customer trends at a glance. Make smarter decisions.',
  },
];

const StarIcon = () => (
  <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4 text-success shrink-0" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

export default function HomePage() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white">

      {/* ── Header ── */}
      <header className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">C</span>
            </div>
            <span className="text-xl font-bold text-gray-900">ClientFlow</span>
          </div>
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">Features</a>
            <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">How It Works</a>
            <a href="#pricing" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">Pricing</a>
            <a href="#faq" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/dashboard" className="btn-primary text-sm px-4 py-2">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-gray-600 hover:text-gray-900 font-medium text-sm hidden sm:block">
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
      <section className="bg-gradient-to-br from-primary-50 via-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32">
          <div className="lg:grid lg:grid-cols-2 lg:gap-16 items-center">
            {/* Copy */}
            <div>
              <div className="inline-flex items-center bg-primary-100 text-primary text-xs font-semibold px-3 py-1 rounded-full mb-6">
                Built for service businesses
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Run your business,<br />
                <span className="text-primary">not paperwork</span>
              </h1>
              <p className="text-lg text-gray-600 mb-8 max-w-lg">
                Online booking, customer tracking, automated reminders, and review management — all in one platform built for salons, barbershops, and service pros.
              </p>
              {isAuthenticated ? (
                <Link href="/dashboard" className="btn-primary text-base px-8 py-3 inline-block">
                  Go to Dashboard
                </Link>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <Link href="/register" className="btn-primary text-base px-8 py-3 inline-block">
                    Start Free — 14 Days
                  </Link>
                  <p className="text-sm text-gray-500">No credit card required</p>
                </div>
              )}
              {/* Trust signals */}
              <div className="flex items-center gap-5 mt-8 flex-wrap">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(i => <StarIcon key={i} />)}
                  <span className="text-sm text-gray-600 ml-1">4.9/5 rating</span>
                </div>
                <span className="text-gray-300 hidden sm:block">|</span>
                <span className="text-sm text-gray-600">500+ businesses trust ClientFlow</span>
              </div>
            </div>

            {/* Dashboard mockup */}
            <div className="hidden lg:block mt-12 lg:mt-0">
              <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                {/* Fake browser bar */}
                <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  <div className="flex-1 mx-4 bg-gray-200 rounded h-5"></div>
                </div>
                {/* Dashboard content */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <div className="h-4 w-36 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 w-24 bg-gray-100 rounded"></div>
                    </div>
                    <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">J</span>
                    </div>
                  </div>
                  {/* Stat cards */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { label: "Today's Appts", val: '8', color: 'bg-blue-50' },
                      { label: 'New Customers', val: '3', color: 'bg-green-50' },
                      { label: 'Reviews', val: '24', color: 'bg-yellow-50' },
                    ].map(stat => (
                      <div key={stat.label} className={`${stat.color} rounded-lg p-3`}>
                        <div className="text-xl font-bold text-gray-900">{stat.val}</div>
                        <div className="text-[10px] text-gray-500 leading-tight mt-0.5">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Mini appointment list */}
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Today&apos;s Schedule</p>
                  <div className="space-y-2">
                    {[
                      { name: 'Alex M.', time: '9:00 AM', service: 'Haircut' },
                      { name: 'Sarah K.', time: '10:30 AM', service: 'Highlights' },
                      { name: 'James R.', time: '12:00 PM', service: 'Trim & Style' },
                    ].map(appt => (
                      <div key={appt.name} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-primary text-[10px] font-bold">{appt.name[0]}</span>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-900">{appt.name}</div>
                            <div className="text-[10px] text-gray-500">{appt.service}</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-medium text-primary bg-primary-50 px-2 py-0.5 rounded-full">{appt.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Strip ── */}
      <section className="border-y border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { val: '500+', label: 'Businesses using ClientFlow' },
              { val: '50k+', label: 'Appointments booked' },
              { val: '99.9%', label: 'Platform uptime' },
              { val: '3 min', label: 'Average setup time' },
            ].map(stat => (
              <div key={stat.label}>
                <div className="text-3xl font-bold text-primary mb-1">{stat.val}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="bg-gray-50 py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Everything you need to grow</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Stop juggling multiple tools. ClientFlow brings everything together so you can focus on your customers.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {features.map(feat => (
              <div key={feat.title} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {feat.icon}
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feat.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="bg-white py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Up and running in minutes</h2>
            <p className="text-lg text-gray-600">Three simple steps to transform how you run your business.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-12 md:gap-8">
            {[
              {
                step: '1',
                title: 'Set up your profile',
                desc: 'Add your services, staff, and business hours. Customize your booking page in minutes.',
              },
              {
                step: '2',
                title: 'Share your booking link',
                desc: 'Drop your link on Instagram, Google, or your website — customers can book instantly.',
              },
              {
                step: '3',
                title: 'Watch your business grow',
                desc: 'Manage your schedule, collect reviews automatically, and track every customer — all in one place.',
              },
            ].map(step => (
              <div key={step.step} className="text-center">
                <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg" style={{ boxShadow: '0 8px 24px rgba(59,130,246,0.25)' }}>
                  <span className="text-3xl font-bold text-white">{step.step}</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-500 max-w-xs mx-auto leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="bg-primary-50 py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Loved by service businesses</h2>
            <p className="text-lg text-gray-600">Real results from real business owners.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            {testimonials.map(t => (
              <div key={t.name} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col">
                <div className="flex mb-3">
                  {[1, 2, 3, 4, 5].map(i => <StarIcon key={i} />)}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-5 flex-1">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shrink-0">
                    <span className="text-white text-sm font-bold">{t.initials}</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-500">{t.business}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="bg-white py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-lg text-gray-600">Start free for 14 days. No credit card required.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">

            {/* Starter */}
            <div className="rounded-2xl border border-gray-200 p-8 flex flex-col">
              <h3 className="text-xl font-bold text-gray-900 mb-1">Starter</h3>
              <p className="text-sm text-gray-500 mb-4">Great for solo operators</p>
              <p className="text-4xl font-bold text-gray-900 mb-6">$29<span className="text-lg text-gray-400 font-normal">/mo</span></p>
              <ul className="space-y-3 mb-8 flex-1">
                {['Up to 100 customers', '2 staff members', 'Online booking', 'Review management', 'Walk-in check-in'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
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

            {/* Pro */}
            <div className="rounded-2xl border-2 border-primary p-8 flex flex-col relative bg-primary-50">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-white px-4 py-1 rounded-full text-xs font-semibold">Most Popular</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Pro</h3>
              <p className="text-sm text-gray-500 mb-4">For growing businesses</p>
              <p className="text-4xl font-bold text-gray-900 mb-6">$79<span className="text-lg text-gray-400 font-normal">/mo</span></p>
              <ul className="space-y-3 mb-8 flex-1">
                {['Up to 1,000 customers', '10 staff members', 'Everything in Starter', 'Loyalty program', 'SMS campaigns', 'Priority support'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckIcon />{f}
                  </li>
                ))}
              </ul>
              {isAuthenticated ? (
                <Link href="/pricing" className="btn-primary w-full text-center">View Plans</Link>
              ) : (
                <Link href="/register?plan=pro" className="btn-primary w-full text-center">Start Free Trial</Link>
              )}
            </div>

            {/* Premium */}
            <div className="rounded-2xl border border-gray-200 p-8 flex flex-col">
              <h3 className="text-xl font-bold text-gray-900 mb-1">Premium</h3>
              <p className="text-sm text-gray-500 mb-4">For multi-location businesses</p>
              <p className="text-4xl font-bold text-gray-900 mb-6">$149<span className="text-lg text-gray-400 font-normal">/mo</span></p>
              <ul className="space-y-3 mb-8 flex-1">
                {['Unlimited customers', 'Unlimited staff', 'Everything in Pro', 'Advanced analytics', 'Custom integrations', 'Dedicated support'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
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
      <section id="faq" className="bg-gray-50 py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Frequently asked questions</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <button
                  className="w-full text-left px-6 py-4 flex items-center justify-between font-medium text-gray-900 hover:bg-gray-50 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{faq.q}</span>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform shrink-0 ml-4 ${openFaq === i ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-gray-600 text-sm leading-relaxed">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-primary py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Ready to grow your business?</h2>
          <p className="text-lg text-primary-200 mb-8">Start your free 14-day trial. No credit card required.</p>
          {isAuthenticated ? (
            <Link href="/dashboard" className="bg-white text-primary font-semibold px-8 py-3 rounded-lg hover:bg-primary-50 transition-colors inline-block">
              Go to Dashboard
            </Link>
          ) : (
            <Link href="/register" className="bg-white text-primary font-semibold px-8 py-3 rounded-lg hover:bg-primary-50 transition-colors inline-block">
              Get Started Free
            </Link>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl">C</span>
                </div>
                <span className="text-xl font-bold text-gray-900">ClientFlow</span>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed">
                The all-in-one platform for service businesses to manage customers, bookings, and reviews.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4 text-sm">Product</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#features" className="hover:text-gray-900 transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a></li>
                <li><a href="#faq" className="hover:text-gray-900 transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4 text-sm">Company</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-gray-900 transition-colors">About</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4 text-sm">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-gray-900 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-100 mt-10 pt-8 text-center text-sm text-gray-400">
            © 2026 ClientFlow. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  );
}
