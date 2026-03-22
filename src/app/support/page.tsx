import Link from 'next/link';
import { PublicSiteHeader } from '@/components/layout/PublicSiteHeader';
import { SupportContactForm } from '@/components/support/SupportContactForm';
import { APP_NAME, APP_SUPPORT_EMAIL } from '@/lib/brand';

const supportTopics = [
  'Account access',
  'Billing questions',
  'Bug reports',
  'General product support',
];

export default function SupportPage() {
  return (
    <div className="page-shell min-h-screen">
      <PublicSiteHeader active="support" />

      <section className="border-b border-gray-200/70 bg-white/70 py-16 dark:border-gray-900 dark:bg-gray-950/60">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="space-y-6">
              <div className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                Support
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-5xl">
                  Get help from {APP_NAME}
                </h1>
                <p className="mt-4 max-w-xl text-lg leading-8 text-gray-700 dark:text-gray-300">
                  Use the support form or email us directly at{' '}
                  <a href={`mailto:${APP_SUPPORT_EMAIL}`} className="text-primary hover:underline">
                    {APP_SUPPORT_EMAIL}
                  </a>
                  .
                </p>
              </div>

              <div className="card rounded-[28px] p-6">
                <h2 className="text-lg font-semibold text-gray-950 dark:text-white">
                  What this page is for
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {supportTopics.map((topic) => (
                    <div
                      key={topic}
                      className="rounded-2xl border border-gray-200/80 bg-white/80 px-4 py-3 text-sm font-medium text-gray-800 dark:border-gray-800 dark:bg-gray-900/75 dark:text-gray-200"
                    >
                      {topic}
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a href={`mailto:${APP_SUPPORT_EMAIL}`} className="btn-primary">
                    Email {APP_SUPPORT_EMAIL}
                  </a>
                  <Link href="/" className="btn-outline">
                    Back to Home
                  </Link>
                </div>
              </div>
            </div>

            <SupportContactForm />
          </div>
        </div>
      </section>
    </div>
  );
}
