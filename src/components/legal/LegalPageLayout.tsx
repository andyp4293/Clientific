import type { ReactNode } from 'react';
import Link from 'next/link';
import { ClientificLogo } from '@/components/brand/ClientificLogo';

interface LegalSection {
  id: string;
  title: string;
}

interface LegalPageLayoutProps {
  title: string;
  subtitle: string;
  lastUpdated: string;
  sections: LegalSection[];
  children: ReactNode;
  secondaryCtaHref: string;
  secondaryCtaLabel: string;
}

export function LegalPageLayout({
  title,
  subtitle,
  lastUpdated,
  sections,
  children,
  secondaryCtaHref,
  secondaryCtaLabel,
}: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,#f8fbfb_0%,#eef5f3_100%)] px-4 py-10 text-slate-900 dark:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),_transparent_25%),linear-gradient(180deg,#07131f_0%,#0b1724_100%)] dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur transition hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-emerald-500/40 dark:hover:text-emerald-300"
          >
            <span aria-hidden="true">←</span>
            Back to Home
          </Link>
          <ClientificLogo
            className="hidden items-center gap-3 sm:inline-flex"
            markClassName="h-9 w-9 text-slate-950 dark:text-white"
            nameClassName="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="h-fit rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-white/[0.05] dark:shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">
              Legal
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{subtitle}</p>
            <div className="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
              Last updated: <span className="font-semibold text-slate-900 dark:text-slate-100">{lastUpdated}</span>
            </div>

            <nav className="mt-6 space-y-2">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.05] dark:hover:text-white"
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </aside>

          <main className="rounded-[32px] border border-slate-200/80 bg-white/92 shadow-[0_32px_100px_rgba(15,23,42,0.10)] backdrop-blur dark:border-white/10 dark:bg-white/[0.05] dark:shadow-[0_32px_100px_rgba(0,0,0,0.32)]">
            <div className="border-b border-slate-200/80 px-6 py-6 dark:border-white/10 sm:px-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600 dark:text-emerald-300">
                    {title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Written to match the current Clientific product flow, including subscriptions, SMS,
                    AI receptionist, and payouts.
                  </p>
                </div>
                <Link href={secondaryCtaHref} className="btn-primary">
                  {secondaryCtaLabel}
                </Link>
              </div>
            </div>

            <div className="space-y-10 px-6 py-8 sm:px-8 sm:py-10">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-7 text-slate-700 dark:text-slate-300">{children}</div>
    </section>
  );
}
