'use client';

import Image from 'next/image';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { PublicOwnerBackButton } from '@/components/public/PublicOwnerBackButton';
import { formatPhoneForDisplay } from '@/lib/phone';

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  lastVisit?: string | null;
};

type LookupResponse =
  | { status: 'new'; normalizedPhone: string; displayPhone: string }
  | { status: 'existing'; customer: Customer }
  | { status: 'multiple'; customers: Customer[] };

type QuickStep = 'phone' | 'new' | 'multiple' | 'success';

type CheckInKioskProps = {
  business: {
    name: string;
    publicId: string;
    logoUrl: string | null;
  };
  viewerCanManage: boolean;
};

type SuccessState = {
  customerName: string;
  phoneDisplay: string;
  checkInTime: string;
  createdCustomer: boolean;
};

const PHONE_MAX_LENGTH = 11;
const SUCCESS_RESET_SECONDS = 8;
const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const;

function sanitizePhoneDigits(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 10) return digits;
  if (digits.length === 11 && digits.startsWith('1')) return digits;
  if (digits.length > 11 && digits.startsWith('1')) return digits.slice(0, 11);
  return digits.slice(0, 10);
}

function formatPhoneEntry(value: string) {
  const digits = sanitizePhoneDigits(value);
  const normalized = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (!normalized) return '';
  if (normalized.length <= 3) return normalized;
  if (normalized.length <= 6) return `(${normalized.slice(0, 3)}) ${normalized.slice(3)}`;
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6, 10)}`;
}

function canLookupPhone(value: string) {
  const digits = sanitizePhoneDigits(value);
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
}

function formatSuccessTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatLastVisit(isoString: string | null | undefined) {
  if (!isoString) return 'No previous visit yet';
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function KeypadButton({
  label,
  hint,
  onClick,
  className = '',
}: {
  label: string;
  hint?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative min-h-[84px] overflow-hidden rounded-[1.65rem] border border-gray-200 bg-white/80 text-left shadow-[0_18px_45px_-28px_rgba(16,72,56,0.42)] transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_24px_50px_-28px_rgba(16,72,56,0.55)] dark:border-white/10 dark:bg-white/[0.06] dark:hover:border-primary/40 ${className}`}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="flex h-full flex-col items-center justify-center gap-1 px-3 py-4">
        <span className="text-2xl font-semibold text-gray-950 dark:text-white">{label}</span>
        {hint ? (
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
            {hint}
          </span>
        ) : null}
      </div>
    </button>
  );
}

export default function CheckInKiosk({ business, viewerCanManage }: CheckInKioskProps) {
  const [quickStep, setQuickStep] = useState<QuickStep>('phone');
  const [quickDigits, setQuickDigits] = useState('');
  const [quickPhoneDisplay, setQuickPhoneDisplay] = useState('');
  const [quickMatchedCustomers, setQuickMatchedCustomers] = useState<Customer[]>([]);
  const [quickLookupError, setQuickLookupError] = useState<string | null>(null);
  const [quickSuccess, setQuickSuccess] = useState<SuccessState | null>(null);
  const [successCountdown, setSuccessCountdown] = useState(SUCCESS_RESET_SECONDS);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const quickFormattedPhone = useMemo(() => formatPhoneEntry(quickDigits), [quickDigits]);
  const quickPhoneReady = useMemo(() => canLookupPhone(quickDigits), [quickDigits]);

  const resetFlow = useCallback(() => {
    setQuickStep('phone');
    setQuickDigits('');
    setQuickPhoneDisplay('');
    setQuickMatchedCustomers([]);
    setQuickLookupError(null);
    setQuickSuccess(null);
    setSuccessCountdown(SUCCESS_RESET_SECONDS);
    setNewCustomerForm({ name: '', email: '' });
    setIsSubmitting(false);
  }, []);

  useEffect(() => {
    if (!quickSuccess) return;
    setSuccessCountdown(SUCCESS_RESET_SECONDS);
    const interval = window.setInterval(() => {
      setSuccessCountdown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [quickSuccess]);

  useEffect(() => {
    if (quickSuccess && successCountdown === 0) {
      resetFlow();
    }
  }, [quickSuccess, resetFlow, successCountdown]);

  useEffect(() => {
    if (quickStep !== 'phone') return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key >= '0' && event.key <= '9') {
        event.preventDefault();
        setQuickLookupError(null);
        setQuickDigits((current) => sanitizePhoneDigits(`${current}${event.key}`.slice(0, PHONE_MAX_LENGTH)));
        return;
      }

      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        setQuickLookupError(null);
        setQuickDigits((current) => current.slice(0, -1));
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quickStep]);

  async function finalizeCheckIn(
    payload: { customerId?: string; phone?: string; customerName?: string; customerEmail?: string },
    meta: { customerName: string; phoneDisplay: string; createdCustomer: boolean }
  ) {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/public/business-by-id/${business.publicId}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || 'Failed to check in guest');
      }

      setQuickStep('success');
      setQuickSuccess({
        customerName: meta.customerName,
        phoneDisplay: meta.phoneDisplay,
        createdCustomer: meta.createdCustomer,
        checkInTime: body.checkIn.checkInTime,
      });
      setQuickLookupError(null);
    } catch (error) {
      setQuickLookupError(error instanceof Error ? error.message : 'Failed to check in guest');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLookup() {
    if (!quickPhoneReady) {
      setQuickLookupError('Enter a valid 10-digit US phone number to continue.');
      return;
    }

    setQuickLookupError(null);
    setQuickMatchedCustomers([]);
    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/public/business-by-id/${business.publicId}/check-in?phone=${encodeURIComponent(quickDigits)}`
      );
      const body = (await response.json().catch(() => ({}))) as LookupResponse & { error?: string };
      if (!response.ok) {
        throw new Error(body.error || 'Failed to look up guest');
      }

      if (body.status === 'new') {
        setQuickPhoneDisplay(body.displayPhone || quickFormattedPhone);
        setQuickStep('new');
        return;
      }

      if (body.status === 'multiple') {
        setQuickPhoneDisplay(quickFormattedPhone);
        setQuickMatchedCustomers(body.customers);
        setQuickStep('multiple');
        return;
      }

      await finalizeCheckIn(
        { customerId: body.customer.id, phone: quickDigits },
        {
          customerName: body.customer.name,
          phoneDisplay: formatPhoneForDisplay(body.customer.phone) || quickFormattedPhone,
          createdCustomer: false,
        }
      );
    } catch (error) {
      setQuickLookupError(error instanceof Error ? error.message : 'Failed to look up guest');
      setIsSubmitting(false);
    } finally {
      if (!quickSuccess) {
        setIsSubmitting(false);
      }
    }
  }

  async function handleCreateCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = newCustomerForm.name.trim();
    if (!trimmedName) {
      setQuickLookupError('Customer name is required for a new phone number.');
      return;
    }

    await finalizeCheckIn(
      {
        phone: quickDigits,
        customerName: trimmedName,
        customerEmail: newCustomerForm.email.trim() || undefined,
      },
      {
        customerName: trimmedName,
        phoneDisplay: quickPhoneDisplay || quickFormattedPhone,
        createdCustomer: true,
      }
    );
  }

  async function handleMatchSelect(customer: Customer) {
    await finalizeCheckIn(
      { customerId: customer.id, phone: quickDigits },
      {
        customerName: customer.name,
        phoneDisplay: formatPhoneForDisplay(customer.phone) || quickPhoneDisplay,
        createdCustomer: false,
      }
    );
  }

  function handleKeypadPress(key: (typeof KEYPAD_KEYS)[number]) {
    setQuickLookupError(null);
    if (key === 'clear') {
      setQuickDigits('');
      return;
    }
    if (key === 'back') {
      setQuickDigits((current) => current.slice(0, -1));
      return;
    }
    setQuickDigits((current) => sanitizePhoneDigits(`${current}${key}`.slice(0, PHONE_MAX_LENGTH)));
  }

  const successProgressPercent = `${(successCountdown / SUCCESS_RESET_SECONDS) * 100}%`;

  return (
    <div className="page-shell min-h-screen px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-6xl space-y-3 sm:space-y-4">
        {viewerCanManage ? (
          <PublicOwnerBackButton fallbackHref="/dashboard/checkins" label="Back to dashboard" />
        ) : null}

        <div className="grid gap-5 md:grid-cols-[1fr,0.95fr] md:gap-6">
          <section className="brand-hero hidden min-h-[680px] flex-col justify-between rounded-[2rem] p-8 shadow-2xl shadow-primary-950/20 md:flex lg:p-10">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                {business.logoUrl ? (
                  <Image
                    src={business.logoUrl}
                    alt={`${business.name} logo`}
                    width={88}
                    height={88}
                    className="h-20 w-20 rounded-3xl border border-gray-200/80 object-cover dark:border-white/15"
                  />
                ) : (
                  <div className="brand-hero-card flex h-20 w-20 items-center justify-center rounded-3xl text-3xl font-bold uppercase text-gray-950 dark:text-white">
                    {business.name.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">In-store check-in</p>
                  <h1 className="mt-2 text-4xl font-bold leading-tight text-gray-950 dark:text-white">
                    Guests check in with one phone number.
                  </h1>
                </div>
              </div>

              <div className="max-w-2xl space-y-4">
                <p className="text-lg text-gray-800 dark:text-white/92">
                  Existing guests go straight to a thank-you screen. New numbers only add a name once, then they are ready
                  for future visits at {business.name}.
                </p>
                <p className="text-sm text-gray-700 dark:text-white/70">
                  Clientific treats <span className="font-semibold">8482612613</span> and <span className="font-semibold">+18482612613</span> as
                  the same guest record, so front-desk lookup stays consistent.
                </p>
              </div>
            </div>

            <div className="brand-hero-card max-w-xl rounded-3xl p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">How it works</p>
              <ol className="mt-4 space-y-2 text-sm leading-6 text-gray-700 dark:text-white/80">
                <li>1. Enter the guest&apos;s mobile number on the keypad.</li>
                <li>2. Existing numbers check in instantly.</li>
                <li>3. New numbers ask for a name and optional email once.</li>
              </ol>
            </div>
          </section>

          <section className="brand-panel rounded-[2rem] p-5 sm:p-6 md:min-h-[680px] md:p-8 lg:p-10">
            <div className="space-y-4 border-b border-gray-200/80 pb-5 dark:border-gray-800 md:hidden">
              <div className="flex items-center gap-3">
                {business.logoUrl ? (
                  <Image
                    src={business.logoUrl}
                    alt={`${business.name} logo`}
                    width={56}
                    height={56}
                    className="h-14 w-14 rounded-2xl border border-primary/10 object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold uppercase text-white shadow-sm">
                    {business.name.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">In-store check-in</p>
                  <h2 className="mt-1 text-2xl font-bold text-gray-950 dark:text-gray-50">{business.name}</h2>
                </div>
              </div>
              <p className="text-sm leading-6 text-gray-800 dark:text-gray-100">
                Existing guests move straight through. New guests only need a name once.
              </p>
            </div>

            {quickStep === 'phone' ? (
              <div className="mx-auto flex w-full max-w-2xl flex-col justify-center space-y-6 md:min-h-[580px]">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Phone-first front desk flow</p>
                  <h2 className="text-3xl font-bold text-gray-950 dark:text-gray-50 sm:text-4xl">Start with the guest&apos;s mobile number</h2>
                  <p className="text-sm leading-6 text-gray-700 dark:text-gray-200 sm:text-base">
                    Guests type only their number here. If it is already in Clientific, they are checked in right away.
                  </p>
                </div>

                <div className="rounded-[30px] border border-gray-200/80 bg-white/80 p-5 shadow-[0_24px_60px_-40px_rgba(16,72,56,0.35)] dark:border-white/10 dark:bg-white/[0.04] sm:p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">Guest number</p>
                      <p className="mt-3 text-3xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-4xl">
                        {quickFormattedPhone || '(___) ___-____'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={resetFlow}
                      className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:text-gray-950 dark:border-white/10 dark:text-gray-300 dark:hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      Existing number: instant check-in
                    </span>
                    <span className="rounded-full bg-gray-900/6 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-300">
                      New number: ask for name
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {KEYPAD_KEYS.map((key) => (
                    <KeypadButton
                      key={key}
                      label={key === 'clear' ? 'Clear' : key === 'back' ? 'Delete' : key}
                      hint={key === 'back' ? 'Backspace' : undefined}
                      onClick={() => handleKeypadPress(key)}
                      className={key === 'clear' || key === 'back' ? 'text-primary' : ''}
                    />
                  ))}
                </div>

                {quickLookupError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
                    {quickLookupError}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Numbers typed as <span className="font-semibold">8482612613</span> and{' '}
                    <span className="font-semibold">+18482612613</span> are treated as the same guest.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void handleLookup()}
                  disabled={!quickPhoneReady || isSubmitting}
                  className="btn-primary min-h-[60px] w-full text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Checking number...' : 'Continue'}
                </button>
              </div>
            ) : null}

            {quickStep === 'new' ? (
              <div className="mx-auto flex w-full max-w-2xl flex-col justify-center space-y-6 md:min-h-[580px]">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">New guest</p>
                  <h2 className="text-3xl font-bold text-gray-950 dark:text-white sm:text-4xl">
                    Save this number once and move on
                  </h2>
                  <p className="text-sm leading-6 text-gray-700 dark:text-gray-200 sm:text-base">
                    We could not find {quickPhoneDisplay}. Add a name so this guest checks in faster next time.
                  </p>
                </div>

                <form onSubmit={handleCreateCustomer} className="space-y-5">
                  <div className="rounded-[28px] border border-gray-200/80 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.04]">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="label" htmlFor="check-in-name">
                          Full name <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="check-in-name"
                          type="text"
                          value={newCustomerForm.name}
                          onChange={(event) =>
                            setNewCustomerForm((current) => ({ ...current, name: event.target.value }))
                          }
                          className="input min-h-[56px] text-base"
                          placeholder="Jane Smith"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="label" htmlFor="check-in-phone">Mobile number</label>
                        <input
                          id="check-in-phone"
                          value={quickPhoneDisplay || quickFormattedPhone}
                          readOnly
                          className="input min-h-[56px] cursor-default bg-gray-100/80 dark:bg-white/[0.06]"
                        />
                      </div>
                    </div>
                    <div className="mt-5">
                      <label className="label" htmlFor="check-in-email">Email (optional)</label>
                      <input
                        id="check-in-email"
                        type="email"
                        value={newCustomerForm.email}
                        onChange={(event) =>
                          setNewCustomerForm((current) => ({ ...current, email: event.target.value }))
                        }
                        className="input min-h-[56px] text-base"
                        placeholder="guest@example.com"
                      />
                    </div>
                  </div>

                  {quickLookupError ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
                      {quickLookupError}
                    </div>
                  ) : null}

                  <div className="flex flex-col-reverse gap-3 sm:flex-row">
                    <button type="button" onClick={resetFlow} className="btn-outline min-h-[58px] flex-1">
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn-primary min-h-[58px] flex-1 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting ? 'Saving guest...' : 'Save and check in'}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}

            {quickStep === 'multiple' ? (
              <div className="mx-auto flex w-full max-w-3xl flex-col justify-center space-y-6 md:min-h-[580px]">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Pick the right guest</p>
                  <h2 className="text-3xl font-bold text-gray-950 dark:text-white sm:text-4xl">
                    We found more than one record for {quickPhoneDisplay}
                  </h2>
                  <p className="text-sm leading-6 text-gray-700 dark:text-gray-200 sm:text-base">
                    Choose the correct guest and we will finish the check-in right away.
                  </p>
                </div>

                <div className="grid gap-3">
                  {quickMatchedCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => void handleMatchSelect(customer)}
                      className="rounded-[26px] border border-gray-200/80 bg-white/80 px-5 py-4 text-left shadow-[0_20px_50px_-36px_rgba(16,72,56,0.4)] transition hover:border-primary/30 hover:bg-primary/5 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-primary/40"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-lg font-semibold text-gray-950 dark:text-white">{customer.name}</p>
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                            {formatPhoneForDisplay(customer.phone) || quickPhoneDisplay}
                          </p>
                          {customer.email ? (
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{customer.email}</p>
                          ) : null}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                            Last visit
                          </span>
                          <span className="mt-2 block font-medium text-gray-950 dark:text-white">
                            {formatLastVisit(customer.lastVisit)}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {quickLookupError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
                    {quickLookupError}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={resetFlow} className="btn-outline min-h-[58px] flex-1">
                    Back to keypad
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickMatchedCustomers([]);
                      setQuickStep('new');
                    }}
                    className="btn-secondary min-h-[58px] flex-1"
                  >
                    None of these guests
                  </button>
                </div>
              </div>
            ) : null}

            {quickStep === 'success' && quickSuccess ? (
              <div className="mx-auto flex w-full max-w-2xl flex-col justify-center space-y-6 text-center md:min-h-[580px]">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Check-in complete</p>
                  <h2 className="text-4xl font-bold tracking-tight text-gray-950 dark:text-white">
                    Thanks, {quickSuccess.customerName.split(/\s+/)[0]}.
                  </h2>
                  <p className="text-base leading-7 text-gray-700 dark:text-gray-200">
                    Checked in at {formatSuccessTime(quickSuccess.checkInTime)} using {quickSuccess.phoneDisplay}.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {quickSuccess.createdCustomer
                      ? 'This was a brand new guest record, so the front desk will be faster next time.'
                      : 'We found the existing customer record and moved the visit through instantly.'}
                  </p>
                </div>
                <div className="rounded-[28px] border border-primary/20 bg-primary/8 p-5 text-left">
                  <p className="text-sm font-semibold text-gray-950 dark:text-white">
                    Ready for the next guest in {successCountdown} second{successCountdown === 1 ? '' : 's'}.
                  </p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200/80 dark:bg-gray-800">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-700 ease-linear"
                      style={{ width: successProgressPercent }}
                    />
                  </div>
                  <button type="button" onClick={resetFlow} className="btn-primary mt-4 min-h-[52px] w-full">
                    Check in another guest
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
