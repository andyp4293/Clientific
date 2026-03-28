'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

type Business = {
  name: string;
  slug: string | null;
  googleReviewUrl: string | null;
  yelpUrl: string | null;
};

type SmsLog = {
  id: string;
  createdAt: string;
  to: string;
  status: string;
};

export default function ReviewsPage() {
  const [copiedSurveyLink, setCopiedSurveyLink] = useState(false);

  const { data: business } = useQuery<Business>({
    queryKey: ['business'],
    queryFn: async () => {
      const res = await fetch('/api/business');
      if (!res.ok) throw new Error('Failed to fetch business');
      const body = await res.json();
      return body.business ?? body;
    },
  });

  const { data: recentData, isLoading: recentLoading } = useQuery<{ logs: SmsLog[] }>({
    queryKey: ['reviews-recent'],
    queryFn: async () => {
      const res = await fetch('/api/reviews/recent');
      if (!res.ok) return { logs: [] };
      return res.json();
    },
  });

  const logs = recentData?.logs ?? [];
  const hasLinks = Boolean(business?.googleReviewUrl || business?.yelpUrl);
  const surveyLink = business?.slug ? `/feedback/${business.slug}` : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
          Review Management
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Route every review request through a friendly survey so great visits can become public
          reviews and lower ratings stay private.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Customer Survey Page
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                Every request review text now sends customers to a short survey first. A perfect
                score sends them to your public review link. Anything lower stays private and lands
                back here as internal feedback.
              </p>
            </div>
            {surveyLink ? (
              <div className="flex flex-wrap gap-2">
                <a
                  href={surveyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                >
                  Open survey page
                </a>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={async () => {
                    if (!surveyLink) return;
                    try {
                      await navigator.clipboard.writeText(`${window.location.origin}${surveyLink}`);
                      setCopiedSurveyLink(true);
                      window.setTimeout(() => setCopiedSurveyLink(false), 1800);
                    } catch {
                      setCopiedSurveyLink(false);
                    }
                  }}
                >
                  {copiedSurveyLink ? 'Copied' : 'Copy survey link'}
                </button>
              </div>
            ) : null}
          </div>

          {surveyLink ? (
            <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/[0.05] p-4 dark:border-primary/25 dark:bg-primary/[0.08]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Public survey link
              </p>
              <a
                href={surveyLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block break-all text-sm font-medium text-gray-900 underline decoration-primary/30 underline-offset-4 hover:text-primary dark:text-gray-100"
              >
                {surveyLink}
              </a>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400">
              Your business slug is still loading, so the survey link is not ready to display yet.
            </div>
          )}
        </section>

        <section className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Public Review Destination
          </h2>
          {!business ? (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : hasLinks ? (
            <div className="space-y-3">
              {business.googleReviewUrl && (
                <ReviewLinkCard label="Google Reviews" href={business.googleReviewUrl} />
              )}
              {business.yelpUrl && <ReviewLinkCard label="Yelp" href={business.yelpUrl} />}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No Google or Yelp link is set yet. Customers can still leave private feedback through
              the survey.{' '}
              <a
                href="/dashboard/settings?tab=integrations"
                className="font-medium text-primary hover:text-primary-700"
              >
                Add a public review link in Social &amp; Reviews
              </a>
            </p>
          )}
        </section>
      </div>

      <section className="card p-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
          How Review Requests Work
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <InfoStep
            step="Step 1"
            text="From any customer profile, click Request Review after the visit."
          />
          <InfoStep
            step="Step 2"
            text="The customer lands on a friendly survey page instead of jumping straight to Google or Yelp."
          />
          <InfoStep
            step="Step 3"
            text="Top ratings go to your public review link. Lower ratings stay private so you can respond thoughtfully."
          />
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Recent Review Requests
        </h2>
        {recentLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No review requests sent yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Phone</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap py-2 pr-4 text-gray-600 dark:text-gray-400">
                      {format(new Date(log.createdAt), 'MMM d, yyyy h:mm a')}
                    </td>
                    <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">{log.to}</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          log.status === 'delivered'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                            : log.status === 'failed'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ReviewLinkCard({ label, href }: { label: string; href: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
      <svg
        className="h-5 w-5 flex-shrink-0 text-gray-500 dark:text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-sm text-primary hover:text-primary-700"
        >
          {href}
        </a>
      </div>
    </div>
  );
}

function InfoStep({ step, text }: { step: string; text: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{step}</p>
      <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">{text}</p>
    </div>
  );
}
