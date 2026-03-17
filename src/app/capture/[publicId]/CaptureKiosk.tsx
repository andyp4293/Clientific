'use client';

import Image from 'next/image';
import Link from 'next/link';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { InStoreCaptureConfig } from '@/lib/in-store-capture';

type CaptureKioskProps = {
  config: InStoreCaptureConfig;
};

type SuccessState = {
  submittedName: string;
  submittedPhoneLast4: string;
  deal: {
    deliveryType: string;
    title: string;
    code?: string;
    dealUrl?: string;
    expiresAt?: string;
  } | null;
  dealIssue: string | null;
  confirmationSent: boolean;
};

const DEFAULT_FORM = {
  name: '',
  phone: '',
  email: '',
  smsMarketingConsent: true,
};

const SUCCESS_RESET_SECONDS = 15;

export default function CaptureKiosk({ config }: CaptureKioskProps) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [resetCountdown, setResetCountdown] = useState(SUCCESS_RESET_SECONDS);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const hasSelectedDeal = Boolean(config.deal);
  const canSubmit =
    form.name.trim().length > 0 &&
    form.phone.replace(/\D/g, '').length >= 10 &&
    form.smsMarketingConsent &&
    !isSubmitting;
  const mobileIntroBody = hasSelectedDeal
    ? `Join ${config.business.name}'s Clientific text list to receive ${config.deal?.discountLabel} on ${config.deal?.serviceName ?? 'featured services'} plus future service promos and updates.`
    : `Join ${config.business.name}'s Clientific text list for service specials, last-minute openings, and important business updates.`;
  const mobileIntroDetail = hasSelectedDeal
    ? config.deal?.deliveryType === 'purchase_link'
      ? "Enter your info once and we'll text your purchase link right after you submit."
      : "Enter your info once and we'll text your code right after you submit."
    : "Enter your info once and you'll be first to hear about new offers by text.";

  const consentLabel = useMemo(() => {
    if (config.deal) {
      return `Yes, text me this offer and future service promos from ${config.business.name}.`;
    }
    return `Yes, text me future service promos and updates from ${config.business.name}.`;
  }, [config.business.name, config.deal]);

  const progressPercent = `${(resetCountdown / SUCCESS_RESET_SECONDS) * 100}%`;

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const resetForNextCustomer = useCallback(() => {
    setForm(DEFAULT_FORM);
    setSuccess(null);
    setError(null);
    setResetCountdown(SUCCESS_RESET_SECONDS);
    window.setTimeout(() => nameInputRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!success) return;

    setResetCountdown(SUCCESS_RESET_SECONDS);
    const interval = window.setInterval(() => {
      setResetCountdown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [success]);

  useEffect(() => {
    if (success && resetCountdown === 0) {
      resetForNextCustomer();
    }
  }, [resetCountdown, resetForNextCustomer, success]);

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
        submittedPhoneLast4: form.phone.replace(/\D/g, '').slice(-4),
        deal: body.deal ?? null,
        dealIssue: body.dealIssue ?? null,
        confirmationSent: body.confirmationSent === true,
      });
    } catch (submitError: any) {
      setError(submitError?.message || 'Could not save signup');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-shell min-h-screen px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-6xl space-y-3 sm:space-y-4">
        {config.viewerCanManage && (
          <Link
            href="/dashboard/campaigns"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            <span aria-hidden="true">&larr;</span>
            Back to dashboard
          </Link>
        )}

        <div className="flex min-h-[calc(100vh-2rem)] items-stretch sm:min-h-[calc(100vh-3rem)]">
          <div
            data-testid="capture-kiosk-layout"
            className="grid flex-1 gap-5 md:grid-cols-[1.05fr,0.95fr] md:gap-6"
          >
            <div
              data-testid="capture-kiosk-shell"
              className="md:contents"
            >
            <section
              data-testid="capture-kiosk-hero"
              className="hidden md:order-1 md:flex md:min-h-[640px] md:flex-col md:justify-between md:rounded-[2rem] md:bg-[linear-gradient(135deg,rgb(var(--color-gray-900))_0%,rgb(var(--color-gray-800))_55%,rgb(var(--color-primary-800))_100%)] md:p-8 md:text-white md:shadow-2xl md:shadow-primary-950/20 lg:p-10"
            >
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
                    <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
                      {hasSelectedDeal ? "Claim today's service offer." : 'Join the VIP text list.'}
                    </h1>
                  </div>
                </div>

                <div className="max-w-2xl space-y-4">
                  <p className="text-lg text-white/92 sm:text-xl">
                    {config.deal
                      ? `${config.deal.discountLabel} on ${config.deal.serviceName ?? 'featured services'} from ${config.business.name}. Enter your info and we'll text your ${config.deal.deliveryType === 'purchase_link' ? 'purchase link' : 'code'} right away.`
                      : `Get first access to specials, last-minute openings, seasonal promos, and client updates from ${config.business.name}.`}
                  </p>
                  {config.business.publicProfileHeadline && (
                    <p className="text-sm text-white/70 sm:text-base">{config.business.publicProfileHeadline}</p>
                  )}
                </div>
              </div>

              <div className="pt-2 md:pt-8">
                <div className="max-w-xl rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur-sm sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary-200">
                    {hasSelectedDeal ? "Today's offer" : 'Why clients join'}
                  </p>
                  {config.deal ? (
                    <>
                      <p className="mt-3 text-2xl font-semibold">{config.deal.title}</p>
                      <p className="mt-2 text-sm text-white/80">
                        {config.deal.description || 'Claim this service special now and stay on the VIP text list for future offers.'}
                      </p>
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
                      <p className="mt-3 text-2xl font-semibold">Service-first updates</p>
                      <ul className="mt-4 space-y-2 text-sm text-white/80">
                        <li>Early access to member-only specials and seasonal offers</li>
                        <li>Alerts for last-minute openings and slow-day promos</li>
                        <li>Occasional updates from the team, sent by text</li>
                      </ul>
                    </>
                  )}
                </div>
              </div>
            </section>

            <section
              data-testid="capture-kiosk-form"
              className="brand-panel rounded-[2rem] p-5 text-gray-950 sm:p-6 dark:text-gray-50 md:order-2 md:flex md:min-h-[640px] md:flex-col md:justify-center md:p-8 lg:p-10"
            >
              {success ? (
                <div className="space-y-6 text-center sm:space-y-7">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">You're all set</p>
                    <h2 className="text-3xl font-bold text-gray-950 dark:text-gray-50 sm:text-4xl">
                      You're all set, {success.submittedName.split(/\s+/)[0]}.
                    </h2>
                    <p className="mx-auto max-w-xl text-base text-gray-700 dark:text-gray-200 sm:text-lg">
                      {success.deal
                        ? success.deal.deliveryType === 'purchase_link'
                          ? `Your ${success.deal.title} purchase link is on the way by text.`
                          : `Your ${success.deal.title} code is ready. Keep it handy for checkout today.`
                        : `You are now on ${config.business.name}'s VIP text list for service specials, openings, and updates.`}
                    </p>
                  </div>

                  {success.deal && success.deal.deliveryType !== 'purchase_link' && (
                    <div className="rounded-3xl border border-primary/20 bg-primary/8 p-5 sm:p-6">
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Claim code</p>
                      <p className="mt-3 font-mono text-4xl font-bold tracking-[0.22em] text-gray-950 dark:text-gray-50 sm:text-5xl">
                        {success.deal.code}
                      </p>
                      <p className="mt-3 text-sm text-gray-700 dark:text-gray-200 sm:text-base">
                        Show this code at checkout before{' '}
                        {new Date(success.deal.expiresAt!).toLocaleDateString('en-US', {
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

                  <div className="space-y-4 rounded-3xl border border-primary/16 bg-primary/6 p-5 text-left sm:p-6">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-950 dark:text-gray-50">
                      {success.confirmationSent && success.submittedPhoneLast4
                        ? `We just sent a confirmation text to the mobile number ending in ${success.submittedPhoneLast4}.`
                        : "You're signed up. If a text does not arrive shortly, the front desk can help."}
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-200">
                        This screen resets for the next guest in {resetCountdown} second{resetCountdown === 1 ? '' : 's'}.
                      </p>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-gray-200/80 dark:bg-gray-800">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-700 ease-linear"
                        style={{ width: progressPercent }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={resetForNextCustomer}
                      className="btn-secondary min-h-[56px] w-full text-base font-semibold"
                    >
                      Reset now
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-4 border-b border-gray-200/80 pb-5 dark:border-gray-800 md:hidden">
                    <div className="flex items-center justify-between gap-3">
                      <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
                        Clientific
                      </div>
                      {config.deal && (
                        <span className="rounded-full bg-primary/12 px-3 py-1 text-xs font-semibold text-primary">
                          {config.deal.discountLabel}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {config.business.logoUrl ? (
                        <Image
                          src={config.business.logoUrl}
                          alt={`${config.business.name} logo`}
                          width={56}
                          height={56}
                          className="h-14 w-14 rounded-2xl border border-primary/10 object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold uppercase text-white shadow-sm">
                          {config.business.name.charAt(0)}
                        </div>
                      )}

                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                          In-store signup
                        </p>
                        <h2 className="mt-1 text-2xl font-bold text-gray-950 dark:text-gray-50">
                          {config.business.name}
                        </h2>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm leading-6 text-gray-800 dark:text-gray-100">
                        {mobileIntroBody}
                      </p>
                      <p className="text-sm leading-6 text-gray-700 dark:text-gray-200">
                        {mobileIntroDetail}
                      </p>
                    </div>

                    {config.deal?.serviceName && (
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-gray-900/6 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-white/10 dark:text-gray-200">
                          {config.deal.serviceName}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <h2 className="text-2xl font-bold text-gray-950 dark:text-gray-50 sm:text-4xl">
                      {hasSelectedDeal ? "Claim today's offer." : 'Join by text.'}
                    </h2>
                    <p className="mt-2 max-w-xl text-sm text-gray-700 dark:text-gray-200 sm:text-base md:mt-3 md:text-lg">
                      {hasSelectedDeal
                        ? `Mobile phone is required. We'll text your ${config.deal?.deliveryType === 'purchase_link' ? 'purchase link' : 'code'} right after you submit.`
                        : 'Mobile phone is required. Email is optional.'}
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
                          ? 'Claim offer by text'
                          : 'Join by text'}
                    </button>
                  </form>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
