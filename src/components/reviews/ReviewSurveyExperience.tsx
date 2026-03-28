'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessageSquare, Star } from 'lucide-react';

type SurveyResponse = {
  business: {
    name: string;
    slug: string;
    logoUrl: string | null;
    googleReviewUrl: string | null;
    yelpUrl: string | null;
    preferredReviewUrl: string | null;
    preferredReviewLabel: string | null;
  };
  customer: {
    id: string | null;
    name: string;
  } | null;
};

type SubmissionState =
  | null
  | {
      kind: 'public-review';
      preferredReviewUrl: string | null;
      preferredReviewLabel: string | null;
    }
  | {
      kind: 'private-feedback';
    };

const RATING_OPTIONS = [
  { value: 5, label: 'Amazing', note: 'Everything felt excellent.' },
  { value: 4, label: 'Good', note: 'A solid visit with room to improve.' },
  { value: 3, label: 'Okay', note: 'Some things could have gone better.' },
  { value: 2, label: 'Rough', note: 'The visit missed the mark.' },
  { value: 1, label: 'Poor', note: 'It was a disappointing experience.' },
];

export default function ReviewSurveyExperience({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [survey, setSurvey] = useState<SurveyResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionState, setSubmissionState] = useState<SubmissionState>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSurvey = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const query = token ? `?token=${encodeURIComponent(token)}` : '';
        const res = await fetch(`/api/public/review-survey/${encodeURIComponent(slug)}${query}`);
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body.error || 'Failed to load survey');
        }
        if (!cancelled) {
          setSurvey(body);
        }
      } catch (error: any) {
        if (!cancelled) {
          setLoadError(error?.message || 'Failed to load survey');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadSurvey();

    return () => {
      cancelled = true;
    };
  }, [slug, token]);

  const firstName = useMemo(() => {
    const name = survey?.customer?.name?.trim();
    return name ? name.split(/\s+/)[0] : null;
  }, [survey?.customer?.name]);

  async function submitSurvey() {
    if (!selectedRating) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/public/review-survey/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating: selectedRating,
          feedback,
          token,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Failed to submit survey');
      }

      if (selectedRating === 5) {
        setSubmissionState({
          kind: 'public-review',
          preferredReviewUrl: body.preferredReviewUrl,
          preferredReviewLabel: body.preferredReviewLabel,
        });
      } else {
        setSubmissionState({ kind: 'private-feedback' });
      }
    } catch (error: any) {
      setLoadError(error?.message || 'Failed to submit survey');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <SurveyShell>
        <div className="flex min-h-[420px] items-center justify-center rounded-[2rem] border border-gray-200 bg-white/90 p-10 text-center dark:border-white/10 dark:bg-white/[0.03]">
          <div>
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading your feedback page...</p>
          </div>
        </div>
      </SurveyShell>
    );
  }

  if (loadError || !survey) {
    return (
      <SurveyShell>
        <div className="rounded-[2rem] border border-red-200 bg-red-50/90 p-8 text-center dark:border-red-900/40 dark:bg-red-950/30">
          <h1 className="text-2xl font-semibold text-red-900 dark:text-red-100">Feedback page unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-red-700 dark:text-red-200">
            {loadError || 'We could not load this survey right now. Please try again in a moment.'}
          </p>
        </div>
      </SurveyShell>
    );
  }

  if (submissionState?.kind === 'public-review') {
    return (
      <SurveyShell>
        <SuccessPanel
          eyebrow="Thank you"
          title={`Thanks${firstName ? `, ${firstName}` : ''}!`}
          description={
            submissionState.preferredReviewUrl
              ? `We are glad your visit went so well. If you have a moment, would you share it on ${submissionState.preferredReviewLabel || 'a public review site'}?`
              : `We are glad your visit went so well. Your rating has been shared with ${survey.business.name}.`
          }
        >
          {submissionState.preferredReviewUrl ? (
            <a
              href={submissionState.preferredReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full sm:w-auto"
            >
              Leave a {submissionState.preferredReviewLabel || 'review'}
            </a>
          ) : null}
        </SuccessPanel>
      </SurveyShell>
    );
  }

  if (submissionState?.kind === 'private-feedback') {
    return (
      <SurveyShell>
        <SuccessPanel
          eyebrow="Thank you"
          title="Your feedback was sent privately"
          description={`Thanks for helping ${survey.business.name} improve. Your note goes straight to the business and is not posted publicly.`}
        />
      </SurveyShell>
    );
  }

  const selectedOption = RATING_OPTIONS.find((option) => option.value === selectedRating) || null;
  const wantsPrivateFeedback = Boolean(selectedRating && selectedRating < 5);

  return (
    <SurveyShell>
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[2rem] border border-gray-200 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none sm:p-8">
          <div className="flex items-center gap-4">
            {survey.business.logoUrl ? (
              <img
                src={survey.business.logoUrl}
                alt={survey.business.name}
                className="h-16 w-16 rounded-2xl object-cover ring-1 ring-gray-200 dark:ring-white/10"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/[0.12] text-primary">
                <MessageSquare className="h-8 w-8" />
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                Customer survey
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950 dark:text-white sm:text-4xl">
                {firstName ? `${firstName}, how was your visit?` : `How was your visit with ${survey.business.name}?`}
              </h1>
            </div>
          </div>

          <p className="mt-5 text-base leading-7 text-gray-600 dark:text-gray-300">
            Pick the rating that feels right. Top ratings can go to a public review. Anything else
            stays private and goes straight back to {survey.business.name}.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {RATING_OPTIONS.map((option) => {
              const isActive = selectedRating === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setSelectedRating(option.value);
                    setSubmissionState(null);
                    setLoadError(null);
                  }}
                  className={`rounded-[1.5rem] border px-4 py-4 text-left transition ${
                    isActive
                      ? 'border-primary bg-primary/[0.08] shadow-[0_12px_30px_rgba(16,185,129,0.12)] dark:border-primary/60 dark:bg-primary/[0.14]'
                      : 'border-gray-200 bg-gray-50/80 hover:border-primary/40 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-amber-500">
                      {Array.from({ length: option.value }).map((_, index) => (
                        <Star key={index} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {option.label}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400">
                    {option.note}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[2rem] border border-gray-200 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            Next step
          </p>

          {!selectedOption ? (
            <div className="mt-4 rounded-[1.5rem] border border-dashed border-gray-300 bg-gray-50/80 p-6 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Select a rating to continue
              </p>
              <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                We will show the right next step based on how your visit felt.
              </p>
            </div>
          ) : wantsPrivateFeedback ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-[1.5rem] border border-gray-200 bg-gray-50/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Thanks for telling us how it went
                </p>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                  If you want, share a little more below. This goes privately to {survey.business.name}.
                </p>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Private feedback
                </span>
                <textarea
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  rows={6}
                  placeholder="Tell them what stood out, what felt off, or what could have been better."
                  className="mt-3 w-full rounded-[1.5rem] border border-gray-200 bg-white px-4 py-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-100 dark:placeholder:text-gray-500"
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void submitSurvey()}
                  disabled={isSubmitting}
                  className="btn-primary"
                >
                  {isSubmitting ? 'Sending...' : 'Send private feedback'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRating(null)}
                  className="btn-outline"
                >
                  Change rating
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded-[1.5rem] border border-primary/20 bg-primary/[0.07] p-5 dark:border-primary/30 dark:bg-primary/[0.12]">
                <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Thanks for the great rating
                </p>
                <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
                  {`One more tap and we will send you to ${survey.business.name}'s public review page.`}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void submitSurvey()}
                  disabled={isSubmitting}
                  className="btn-primary"
                >
                  {isSubmitting ? 'Sending...' : 'Continue to review'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRating(null)}
                  className="btn-outline"
                >
                  Change rating
                </button>
              </div>
            </div>
          )}

          {loadError ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              {loadError}
            </div>
          ) : null}
        </div>
      </div>
    </SurveyShell>
  );
}

function SurveyShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#d7f4eb,transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef7f3_100%)] px-4 py-10 text-gray-900 dark:bg-[radial-gradient(circle_at_top,#0f3b2e,transparent_30%),linear-gradient(180deg,#07131d_0%,#0c1722_100%)] dark:text-gray-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {children}
      </div>
    </div>
  );
}

function SuccessPanel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-gray-200 bg-white/90 p-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none sm:p-12">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">{eyebrow}</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gray-950 dark:text-white sm:text-4xl">
        {title}
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-600 dark:text-gray-300">
        {description}
      </p>
      {children ? <div className="mt-8 flex justify-center">{children}</div> : null}
    </div>
  );
}
