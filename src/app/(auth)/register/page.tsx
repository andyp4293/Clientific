'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { APP_NAME } from '@/lib/brand';
import { ClientificLogo } from '@/components/brand/ClientificLogo';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { getPublicPlanLabel, getPublicPlanSlug } from '@/lib/plan-utils';

type Step = 1 | 2 | 3;

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  businessName: string;
  businessType: string;
  timezone: string;
  plan: string;
  referralCode: string;
}

function AuthRedirectScreen({ message }: { message: string }) {
  return (
    <div className="page-shell min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{message}</p>
      </div>
    </div>
  );
}

function RegisterForm() {
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const defaultPlan = getPublicPlanSlug(searchParams.get('plan') || 'starter');
  const defaultEmail = searchParams.get('email') || '';
  const refCode = (searchParams.get('ref') || '').trim().toUpperCase();
  const isPartnerSignup = searchParams.get('partner') === '1';
  const oauthProvider = searchParams.get('oauth');
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';
  const partnerBusinessType = 'Referral Partner';

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  const [autoSignInFailed, setAutoSignInFailed] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    email: defaultEmail,
    password: '',
    confirmPassword: '',
    acceptTerms: false,
    businessName: '',
    businessType: isPartnerSignup ? partnerBusinessType : 'Salon',
    timezone: '',
    plan: defaultPlan,
    referralCode: refCode,
  });

  useEffect(() => {
    if (status === 'authenticated' && !pendingRedirect) {
      const targetPath = '/dashboard';
      setPendingRedirect(targetPath);
      window.location.replace(targetPath);
    }
  }, [status, pendingRedirect]);

  useEffect(() => {
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setFormData((prev) => ({
      ...prev,
      timezone: prev.timezone || browserTimezone,
    }));
  }, []);

  const passwordChecks = useMemo(
    () => ({
      minLength: formData.password.length >= 8,
      hasNumber: /[0-9]/.test(formData.password),
      hasSpecialChar: /[!@#$%^&*]/.test(formData.password),
      passwordsMatch:
        formData.password === formData.confirmPassword &&
        formData.confirmPassword.length > 0,
    }),
    [formData.password, formData.confirmPassword]
  );

  if (status === 'loading') {
    return <AuthRedirectScreen message="Loading..." />;
  }

  if (status === 'authenticated' || pendingRedirect) {
    return <AuthRedirectScreen message="Redirecting to your dashboard..." />;
  }

  const businessTypes = [
    'Salon',
    'Spa',
    'Gym',
    'Restaurant',
    'Medical/Dental',
    'Auto Service',
    'Retail',
    'Professional Services',
    'Family Law',
    'Other',
  ];

  const selectedPlanLabel = getPublicPlanLabel(formData.plan);
  const verificationRedirectPath = isPartnerSignup
    ? '/dashboard/payouts'
    : '/dashboard/onboarding';
  const stepItems = isPartnerSignup
    ? [
        { num: 1, label: 'Account' },
        { num: 2, label: 'Profile' },
        { num: 3, label: 'Verify' },
      ]
    : [
        { num: 1, label: 'Account' },
        { num: 2, label: 'Business' },
        { num: 3, label: 'Verify' },
      ];

  const updateFormData = (updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const validateStep = (step: Step): boolean => {
    setError('');

    if (step === 1) {
      if (!formData.email) {
        setError('Email is required');
        return false;
      }
      if (!formData.password || formData.password.length < 8) {
        setError('Password must be at least 8 characters');
        return false;
      }
      if (!/[0-9]/.test(formData.password)) {
        setError('Password must include a number');
        return false;
      }
      if (!/[!@#$%^&*]/.test(formData.password)) {
        setError('Password must include a special character (!@#$%^&*)');
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
      if (!formData.acceptTerms) {
        setError('You must accept the terms of service');
        return false;
      }
      return true;
    }

    if (step === 2) {
      if (!formData.businessName.trim()) {
        setError(isPartnerSignup ? 'Name is required' : 'Business name is required');
        return false;
      }
      return true;
    }

    return true;
  };

  const checkEmailAvailability = async (email: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });
      const data = await response.json();
      return data.available;
    } catch {
      return true;
    }
  };

  const getFriendlyRegistrationError = (rawError: string): string => {
    if (
      rawError.includes('database') ||
      rawError.includes('prisma') ||
      rawError.includes('ECONNREFUSED')
    ) {
      return 'Service temporarily unavailable. Please try again in a few moments.';
    }
    if (
      rawError.includes('already exists') ||
      rawError.includes('duplicate') ||
      rawError.includes('unique constraint')
    ) {
      return 'An account with this email already exists. Please log in instead.';
    }
    if (rawError.includes('required') || rawError.includes('Missing')) {
      return 'Please fill in all required information.';
    }
    return 'Unable to create account. Please check your information and try again.';
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError('');
    setNotice('');

    try {
      const payload = {
        ...formData,
        businessType: isPartnerSignup ? partnerBusinessType : formData.businessType,
        timezone:
          formData.timezone ||
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          'America/New_York',
      };

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(getFriendlyRegistrationError(data.error || 'Registration failed'));
      }

      setCurrentStep(3);
      setEmailVerified(false);
      setAutoSignInFailed(false);
      setVerificationCode('');
      if (!data.verificationEmailSent) {
        setNotice('Account created. Use resend below if your verification code did not arrive.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerification = async () => {
    setIsResendingVerification(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/auth/verify-email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Unable to resend verification code');
      }
      setNotice('If your account exists and is not verified, a new verification code has been sent.');
    } catch (err: any) {
      setError(err.message || 'Unable to resend verification code');
    } finally {
      setIsResendingVerification(false);
    }
  };

  const signInAfterVerification = async () => {
    setAutoSignInFailed(false);
    setPendingRedirect(verificationRedirectPath);

    const result = await signIn('credentials', {
      email: formData.email.trim().toLowerCase(),
      password: formData.password,
      redirect: false,
    });

    if (result?.error) {
      setPendingRedirect(null);
      setAutoSignInFailed(true);
      setNotice(
        isPartnerSignup
          ? 'Email verified successfully. Please log in to finish payout setup.'
          : 'Email verified successfully. Please log in to continue onboarding.'
      );
      return;
    }

    window.location.assign(verificationRedirectPath);
  };

  const verifyEmailCode = async () => {
    const cleanedCode = verificationCode.replace(/\D/g, '');
    if (cleanedCode.length !== 6) {
      setError('Enter the 6-digit verification code from your email.');
      return;
    }

    setIsVerifyingCode(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/auth/verify-email/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          code: cleanedCode,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Unable to verify email');
      }
      setEmailVerified(true);
      setAutoSignInFailed(false);
      setNotice(
        isPartnerSignup
          ? 'Email verified. Redirecting you to payout setup...'
          : 'Email verified. Redirecting you to onboarding...'
      );
      await signInAfterVerification();
    } catch (err: any) {
      setError(err.message || 'Unable to verify email');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const nextStep = async () => {
    if (!validateStep(currentStep)) {
      return;
    }

    if (currentStep === 1) {
      setIsLoading(true);
      const emailAvailable = await checkEmailAvailability(formData.email);
      setIsLoading(false);
      if (!emailAvailable) {
        setError('An account with this email already exists. Please log in instead.');
        return;
      }
    }

    if (currentStep === 2) {
      void handleSubmit();
      return;
    }

    setCurrentStep((prev) => (prev === 3 ? 3 : ((prev + 1) as Step)));
  };

  const prevStep = () => {
    setCurrentStep((prev) => (prev === 1 ? 1 : ((prev - 1) as Step)));
  };

  const handleGoogleSignUp = () => {
    setError('');
    setNotice('');
    void signIn('google', { callbackUrl: '/dashboard' });
  };

  return (
    <div className="page-shell min-h-screen py-8 sm:py-12 px-4">
      <div className="w-full max-w-2xl mx-auto">
        <div className="text-center mb-6 sm:mb-8">
          <Link href="/" className="inline-flex items-center space-x-2">
            <ClientificLogo
              className="inline-flex items-center gap-2"
              markClassName="h-8 w-8 sm:h-10 sm:w-10 text-gray-950 dark:text-white"
              nameClassName="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100"
              title={APP_NAME}
            />
          </Link>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2">
            {isPartnerSignup
              ? 'Create a free referral partner account, finish payout setup, and unlock your recurring referral link.'
              : 'Create your account, verify your email, and finish setup inside the app.'}
          </p>
        </div>

        <div className="mb-6 sm:mb-8">
          <div className="flex items-start">
            {stepItems.map((item, idx) => (
              <React.Fragment key={item.num}>
                {idx > 0 && (
                  <div
                    className={`flex-1 h-0.5 sm:h-1 mx-1 sm:mx-2 mt-4 sm:mt-5 ${
                      currentStep > item.num - 1 ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div
                    className={`w-8 sm:w-10 h-8 sm:h-10 rounded-full flex items-center justify-center font-medium text-sm sm:text-base ${
                      item.num <= currentStep
                        ? 'bg-primary text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {item.num}
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {item.label}
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="card p-4 sm:p-6 lg:p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 px-3 sm:px-4 py-2 sm:py-3 rounded-md mb-4 sm:mb-6 text-xs sm:text-sm">
              {error}
            </div>
          )}
          {notice && (
            <div className="bg-green-50 border border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300 px-3 sm:px-4 py-2 sm:py-3 rounded-md mb-4 sm:mb-6 text-xs sm:text-sm">
              {notice}
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-3 sm:space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gray-900 dark:text-gray-100">
                {isPartnerSignup ? 'Create Your Referral Partner Account' : 'Create Your Account'}
              </h2>

              {oauthProvider === 'google' && (
                <div className="rounded-lg border border-primary/20 bg-primary-50 px-4 py-3 text-sm text-primary-900 dark:border-primary/30 dark:bg-primary/10 dark:text-primary-100">
                  Google sign-up sent you here to finish creating your business account. Add a password so you can sign in directly if needed.
                </div>
              )}

              {formData.referralCode && (
                <div
                  className="rounded-lg border border-primary/20 bg-primary-50 px-4 py-3 text-sm text-primary-900 dark:border-primary/30 dark:bg-primary/10 dark:text-primary-100"
                  data-testid="register-referral-applied"
                >
                  Referral invite applied. If the business that shared this link has finished
                  payout setup, this signup will be connected to their recurring referral credit.
                </div>
              )}

              {googleEnabled && (
                <button type="button" onClick={handleGoogleSignUp} className="btn-outline w-full">
                  Continue with Google
                </button>
              )}

              <div>
                <label htmlFor="email" className="label">
                  Account Email *
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData({ email: e.target.value })}
                  className="input"
                  placeholder="you@example.com"
                  required
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Used for login, password resets, and private account notices. Not shown publicly.
                </p>
              </div>

              <div>
                <label htmlFor="password" className="label">
                  Password *
                </label>
                <input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => updateFormData({ password: e.target.value })}
                  onFocus={() => setPasswordFocused(true)}
                  className="input"
                  placeholder="Min. 8 characters with number & special character"
                  required
                />
                {(passwordFocused || formData.password.length > 0) && (
                  <div className="mt-3 space-y-2 text-sm">
                    <div
                      className={`flex items-center ${
                        passwordChecks.minLength ? 'text-success dark:text-primary-300' : 'text-gray-500'
                      }`}
                    >
                      <span>At least 8 characters</span>
                    </div>
                    <div
                      className={`flex items-center ${
                        passwordChecks.hasNumber ? 'text-success dark:text-primary-300' : 'text-gray-500'
                      }`}
                    >
                      <span>Contains a number</span>
                    </div>
                    <div
                      className={`flex items-center ${
                        passwordChecks.hasSpecialChar ? 'text-success dark:text-primary-300' : 'text-gray-500'
                      }`}
                    >
                      <span>Contains a special character (!@#$%^&*)</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="label">
                  Confirm Password *
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => updateFormData({ confirmPassword: e.target.value })}
                  className="input"
                  placeholder="Re-enter your password"
                  required
                />
              </div>

              <div className="flex items-start">
                <input
                  id="acceptTerms"
                  type="checkbox"
                  checked={formData.acceptTerms}
                  onChange={(e) => updateFormData({ acceptTerms: e.target.checked })}
                  className="rounded border-gray-300 text-primary focus:ring-primary mr-3 mt-1"
                />
                <label htmlFor="acceptTerms" className="text-sm text-gray-600 dark:text-gray-400">
                  I accept the{' '}
                  <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary dark:text-primary-300 hover:underline">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary dark:text-primary-300 hover:underline">
                    Privacy Policy
                  </Link>
                </label>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gray-900 dark:text-gray-100">
                {isPartnerSignup ? 'Set Up Your Partner Profile' : 'Tell Us About Your Business'}
              </h2>

              {isPartnerSignup ? (
                <div className="rounded-2xl border border-primary/20 bg-primary-50 px-4 py-4 dark:border-primary/30 dark:bg-primary/10">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-200">
                    Free partner access
                  </p>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                    This account is for payouts and recurring referrals. You do not need an
                    active Clientific subscription to finish payout setup and use the Referrals
                    and Payouts pages.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-primary/20 bg-primary-50 px-4 py-4 dark:border-primary/30 dark:bg-primary/10">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-200">
                    Free trial
                  </p>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                    You&apos;re starting on the {selectedPlanLabel} trial. We&apos;ll collect
                    your private owner phone, business contact details, and location right after
                    verification.
                  </p>
                </div>
              )}

              <div>
                <label htmlFor="businessName" className="label">
                  {isPartnerSignup ? 'Your Name *' : 'Business Name *'}
                </label>
                <input
                  id="businessName"
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => updateFormData({ businessName: e.target.value })}
                  className="input"
                  placeholder={isPartnerSignup ? 'Jane Smith' : 'Acme Salon & Spa'}
                  required
                />
              </div>

              {!isPartnerSignup && (
                <div>
                  <label htmlFor="businessType" className="label">
                    Business Type *
                  </label>
                  <CustomSelect
                    id="businessType"
                    value={formData.businessType}
                    onChange={(val) => updateFormData({ businessType: val })}
                    options={businessTypes.map((type) => ({ value: type, label: type }))}
                    required
                  />
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                {emailVerified ? 'Email Verified' : 'Check Your Email'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {emailVerified ? (
                  <>
                    Your account is verified for <strong>{formData.email}</strong>.
                  </>
                ) : (
                  <>
                    We sent a 6-digit verification code to <strong>{formData.email}</strong>.
                  </>
                )}
              </p>

              {!emailVerified && (
                <div className="max-w-xs mx-auto mb-6">
                  <label htmlFor="verificationCode" className="label text-left block">
                    Verification Code
                  </label>
                  <input
                    id="verificationCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    className="input text-center tracking-[0.35em] font-semibold"
                    placeholder="000000"
                  />
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-left">
                    Code expires in 10 minutes.
                  </p>
                </div>
              )}

              <div className="card bg-primary-50 dark:bg-primary/10 border-primary-200 dark:border-primary/20 p-6 text-left mb-8">
                <h3 className="font-semibold mb-3">What happens next</h3>
                <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  {isPartnerSignup ? (
                    <>
                      <li>1. Enter the verification code from your inbox.</li>
                      <li>2. We&apos;ll sign you in automatically.</li>
                      <li>3. Finish Stripe payout setup, then open Referrals to copy your recurring link.</li>
                    </>
                  ) : (
                    <>
                      <li>1. Enter the verification code from your inbox.</li>
                      <li>2. We&apos;ll sign you in automatically.</li>
                      <li>3. Finish your phone and location setup before the dashboard unlocks.</li>
                    </>
                  )}
                </ul>
              </div>

              {emailVerified && !autoSignInFailed ? (
                <div className="flex items-center justify-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                  <span>Signing you in...</span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {!emailVerified && (
                    <button
                      type="button"
                      onClick={verifyEmailCode}
                      className="btn-primary px-8 py-3"
                      disabled={isVerifyingCode}
                    >
                      {isVerifyingCode ? 'Verifying...' : 'Verify Code'}
                    </button>
                  )}
                  {!emailVerified && (
                    <button
                      type="button"
                      onClick={resendVerification}
                      className="btn-outline px-8 py-3"
                      disabled={isResendingVerification}
                    >
                      {isResendingVerification ? 'Sending...' : 'Resend Verification Code'}
                    </button>
                  )}
                  <Link href="/login" className="btn-primary px-8 py-3 text-center">
                    {autoSignInFailed ? 'Log In Manually' : 'Go to Login'}
                  </Link>
                </div>
              )}
            </div>
          )}

          {currentStep < 3 && (
            <div className="flex justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              {currentStep > 1 ? (
                <button onClick={prevStep} className="btn-secondary" disabled={isLoading}>
                  Previous
                </button>
              ) : (
                <div />
              )}
              <button onClick={nextStep} className="btn-primary" disabled={isLoading}>
                {isLoading && currentStep === 2
                  ? 'Creating account...'
                  : currentStep === 2
                    ? 'Create account'
                    : 'Next'}
              </button>
            </div>
          )}
        </div>

        <div className="text-center mt-6 text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:text-primary-700 font-medium">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
