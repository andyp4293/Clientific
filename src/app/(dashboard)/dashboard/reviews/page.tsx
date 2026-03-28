'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

type Business = {
  name: string;
  slug: string | null;
  publicId: string | null;
  googleReviewUrl: string | null;
  yelpUrl: string | null;
};

type BusinessResponse = {
  business: Business;
};

type SmsLog = {
  id: string;
  createdAt: string;
  to: string;
  status: string;
};

export default function ReviewsPage() {
  const [copiedSurveyLink, setCopiedSurveyLink] = useState(false);

  const { data: businessData } = useQuery<BusinessResponse>({
    queryKey: ['business-info'],
    queryFn: async () => {
      const res = await fetch('/api/business');
      if (!res.ok) throw new Error('Failed to fetch business');
      return res.json();
    },
  });
  const business = businessData?.business;

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
  const surveyPath = business?.publicId
    ? `/feedback/${business.publicId}`
    : business?.slug
      ? `/feedback/${business.slug}`
      : null;
  const surveyUrl =
    surveyPath && typeof window !== 'undefined' ? `${window.location.origin}${surveyPath}` : surveyPath;

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
          <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Customer Survey Page
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                Every request review text now sends customers to a short survey first. A perfect
                score sends them to your public review link. Anything lower stays private and lands
                back here as internal feedback.
              </p>
              {business?.publicId ? (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Store ID:{' '}
                  <span className="font-mono font-semibold text-primary">{business.publicId}</span>
                </p>
              ) : null}
            </div>
            {surveyPath ? (
              <a
                href={surveyPath}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full flex-shrink-0 items-center justify-center gap-1.5 rounded-xl border border-primary/40 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/5 dark:hover:bg-primary/10 sm:w-auto"
              >
                Preview
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            ) : null}
          </div>

          {surveyUrl ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={surveyUrl}
                  readOnly
                  className="flex-1 rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-xs text-gray-700 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 sm:px-4 sm:text-sm"
                />
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-primary-700 sm:text-sm"
                  onClick={async () => {
                    if (!surveyUrl) return;
                    try {
                      await navigator.clipboard.writeText(surveyUrl);
                      setCopiedSurveyLink(true);
                      window.setTimeout(() => setCopiedSurveyLink(false), 1800);
                    } catch {
                      setCopiedSurveyLink(false);
                    }
                  }}
                >
                  {copiedSurveyLink ? (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                This survey uses the same public store ID pattern as your booking page.
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400">
              Your public survey link is not ready to display yet.
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
