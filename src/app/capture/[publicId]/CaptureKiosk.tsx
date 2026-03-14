'use client';

import Image from 'next/image';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { InStoreCaptureConfig } from '@/lib/in-store-capture';

type CaptureKioskProps = {
  config: InStoreCaptureConfig;
};

type SuccessState = {
  submittedName: string;
  deal: {
    code: string;
    title: string;
    expiresAt: string;
  } | null;
  dealIssue: string | null;
  bookingUrl: string | null;
  confirmationSent: boolean;
  resetAfterMs: number;
};

const DEFAULT_FORM = {
  name: '',
  phone: '',
  email: '',
  smsMarketingConsent: true,
};

export default function CaptureKiosk({ config }: CaptureKioskProps) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const hasSelectedDeal = Boolean(config.deal);
  const canSubmit =
    form.name.trim().length > 0 &&
    form.phone.replace(/\D/g, '').length >= 10 &&
    form.smsMarketingConsent &&
    !isSubmitting;

  const consentLabel = useMemo(() => {
    if (config.deal) {
      return `Yes, text me this offer and future promotions from ${config.business.name}.`;
    }
    return `Yes, text me future promotions and updates from ${config.business.name}.`;
  }, [config.business.name, config.deal]);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!success) {
      setSecondsRemaining(0);
      return;
    }

    const totalSeconds = Math.max(1, Math.ceil(success.resetAfterMs / 1000));
    setSecondsRemaining(totalSeconds);

    const countdownInterval = window.setInterval(() => {
      setSecondsRemaining((current) => (current > 1 ? current - 1 : 1));
    }, 1000);

    const resetTimer = window.setTimeout(() => {
      setForm(DEFAULT_FORM);
      setSuccess(null);
      setError(null);
      window.setTimeout(() => nameInputRef.current?.focus(), 0);
    }, success.resetAfterMs);

    return () => {
      window.clearInterval(countdownInterval);
      window.clearTimeout(resetTimer);
    };
  }, [success]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/public/business-by-id/${config.business.publicId}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: form.email,
          smsMarketingConsent: form.smsMarketingConsent,
          dealId: config.deal?.id ?? null,
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || 'Could not save signup');
      }

      setSuccess({
        submittedName: form.name.trim(),
        deal: body.deal ?? null,
        dealIssue: body.dealIssue ?? null,
        bookingUrl: body.bookingUrl ?? null,
        confirmationSent: body.confirmationSent === true,
        resetAfterMs: typeof body.resetAfterMs === 'number' ? body.resetAfterMs : 6000,
      });
    } catch (submitError: any) {
      setError(submitError?.message || 'Could not save signup');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-shell min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-stretch">
        <div className="grid flex-1 gap-6 lg:grid-cols-[1.15fr,0.85fr]">
          <section className="brand-hero flex flex-col justify-between rounded-[2rem] p-7 text-white shadow-2xl shadow-primary-950/20 sm:p-10">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                {config.business.logoUrl ? (
                  <Image
                    src={config.business.logoUrl}
                    alt={`${config.business.name} logo`}
                    width={88}
                    height={88}
                    className="h-20 w-20 rounded-3xl border border-white/15 object-cover sm:h-24 sm:w-24"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/15 bg-white/10 text-3xl font-bold uppercase sm:h-24 sm:w-24">
                    {config.business.name.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary-200">
                    In-Store Signup
                  </p>
                  <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-5xl">
                    {hasSelectedDeal ? 'Claim today’s promo by text.' : 'Join the VIP text list.'}
                  </h1>
                </div>
              </div>

              <div className="max-w-2xl space-y-4">
                <p className="text-lg text-white/92 sm:text-xl">
                  {config.deal
                    ? `${config.deal.discountLabel} on ${config.deal.serviceName ?? 'select services'} from ${config.business.name}. Enter your info and we’ll text your code right away.`
                    : `Get first access to specials, slow-day promos, and business updates from ${config.business.name}.`}
                </p>
                {config.business.publicProfileHeadline && (
                  <p className="text-sm text-white/70 sm:text-base">{config.business.publicProfileHeadline}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 pt-8 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary-200">Offer</p>
                {config.deal ? (
                  <>
                    <p className="mt-3 text-2xl font-semibold">{config.deal.title}</p>
                    {config.deal.description && (
                      <p className="mt-2 text-sm text-white/75">{config.deal.description}</p>
                    )}
                    <p className="mt-4 text-sm text-white/70">
                      Expires{' '}
                      {new Date(config.deal.expiresAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-3 text-2xl font-semibold">Text-only specials</p>
                    <p className="mt-2 text-sm text-white/75">
                      Promotions, restock alerts, and limited-time offers go here first.
                    </p>
                  </>
                )}
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary-200">What happens next</p>
                <ol className="mt-3 space-y-3 text-sm text-white/85">
                  <li>1. Enter your name and phone number.</li>
                  <li>2. We text your confirmation immediately.</li>
                  <li>3. This screen resets for the next customer automatically.</li>
                </ol>
              </div>
            </div>
          </section>

          <section className="brand-panel flex min-h-[640px] flex-col justify-center rounded-[2rem] p-6 sm:p-8">
            {success ? (
              <div className="space-y-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">You’re in</p>
                  <h2 className="text-3xl font-bold text-gray-950 dark:text-gray-50">
                    Thanks, {success.submittedName.split(/\s+/)[0]}.
                  </h2>
                  <p className="text-base text-gray-700 dark:text-gray-200">
                    {success.deal
                      ? `Your ${success.deal.title} code is ready.`
                      : `You’re now on ${config.business.name}’s text list.`}
                  </p>
                </div>

                {success.deal && (
                  <div className="rounded-3xl border border-primary/20 bg-primary/8 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Claim code</p>
                    <p className="mt-3 font-mono text-4xl font-bold tracking-[0.25em] text-gray-950 dark:text-gray-50">
                      {success.deal.code}
                    </p>
                    <p className="mt-3 text-sm text-gray-700 dark:text-gray-200">
                      Show this code at checkout before{' '}
                      {new Date(success.deal.expiresAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      .
                    </p>
                  </div>
                )}

                {success.dealIssue && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
                    This signup was saved, but the selected promo is no longer available.
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-sm text-gray-700 dark:text-gray-200">
                    {success.confirmationSent
                      ? 'A confirmation text has been sent.'
                      : 'You’re signed up. Ask the front desk if you do not receive a text shortly.'}
                  </p>
                  {success.bookingUrl && (
                    <p className="text-sm text-gray-700 dark:text-gray-200">
                      Booking link: <span className="font-medium text-primary">{success.bookingUrl}</span>
                    </p>
                  )}
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-gray-600 dark:text-gray-200">
                    Resetting for the next customer in {secondsRemaining}s
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">
                    {config.business.name}
                  </p>
                  <h2 className="mt-2 text-3xl font-bold text-gray-950 dark:text-gray-50">
                    {hasSelectedDeal ? 'Enter your info to get the code.' : 'Enter your info to join.'}
                  </h2>
                  <p className="mt-3 text-base text-gray-700 dark:text-gray-200">
                    {hasSelectedDeal
                      ? 'We’ll text your promo code immediately after you submit.'
                      : 'We’ll keep this quick. Phone is required, email is optional.'}
                  </p>
                </div>

                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div className="space-y-4">
                    <div>
                      <label className="label text-base" htmlFor="capture-name">Full name</label>
                      <input
                        ref={nameInputRef}
                        id="capture-name"
                        type="text"
                        autoComplete="name"
                        inputMode="text"
                        className="input min-h-[60px] text-xl"
                        placeholder="Jane Smith"
                        value={form.name}
                        onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                        maxLength={100}
                      />
                    </div>

                    <div>
                      <label className="label text-base" htmlFor="capture-phone">Mobile phone</label>
                      <input
                        id="capture-phone"
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        className="input min-h-[60px] text-xl"
                        placeholder="(555) 123-4567"
                        value={form.phone}
                        onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                        maxLength={30}
                      />
                    </div>

                    <div>
                      <label className="label text-base" htmlFor="capture-email">Email (optional)</label>
                      <input
                        id="capture-email"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        className="input min-h-[60px] text-xl"
                        placeholder="jane@example.com"
                        value={form.email}
                        onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                        maxLength={254}
                      />
                    </div>
                  </div>

                  <label className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/8 p-4 text-sm text-gray-800 dark:text-gray-100">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 rounded border-primary/40 text-primary focus:ring-primary/30"
                      checked={form.smsMarketingConsent}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          smsMarketingConsent: event.target.checked,
                        }))
                      }
                    />
                    <span>
                      <span className="block font-semibold">{consentLabel}</span>
                      <span className="mt-1 block text-xs text-gray-700 dark:text-gray-200">
                        Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help.
                      </span>
                    </span>
                  </label>

                  {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="btn-primary min-h-[64px] w-full text-lg font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting
                      ? 'Saving...'
                      : hasSelectedDeal
                        ? 'Join & Claim Offer'
                        : 'Join & Text Me'}
                  </button>
                </form>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
