'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AddressAutocomplete, { type AddressComponents } from '@/components/ui/AddressAutocomplete';
import { APP_NAME } from '@/lib/brand';
import { timezoneFromCoordinates } from '@/lib/timezone';

type Step = 1 | 2 | 3 | 4;

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  businessName: string;
  businessType: string;
  phone: string;
  businessEmail: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  timezone: string;
  plan: string;
  referralCode: string;
  affiliateCode: string;
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();

  const defaultPlan = searchParams.get('plan') || 'pro';
  const defaultEmail = searchParams.get('email') || '';
  const refCode = searchParams.get('ref') || '';
  const affCode = searchParams.get('aff') || '';
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [formData, setFormData] = useState<FormData>({
    email: defaultEmail,
    password: '',
    confirmPassword: '',
    acceptTerms: false,
    businessName: '',
    businessType: 'Salon',
    phone: '',
    businessEmail: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States',
    timezone: '',
    plan: defaultPlan,
    referralCode: refCode,
    affiliateCode: affCode,
  });

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [status, router]);

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
    return (
      <div className="page-shell min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === 'authenticated') {
    return null;
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
    'Other',
  ];

  const updateFormData = (updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const resolveSubmittedTimezone = async (): Promise<string | null> => {
    if (selectedCoordinates) {
      return timezoneFromCoordinates(selectedCoordinates.latitude, selectedCoordinates.longitude);
    }

    if (!mapboxToken) return null;

    const query = [
      formData.street,
      formData.city,
      formData.state,
      formData.zipCode,
      formData.country,
    ]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', ');

    if (!query) return null;

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query
        )}.json?access_token=${mapboxToken}&limit=1&country=us,ca`
      );
      if (!response.ok) return null;

      const data = (await response.json()) as {
        features?: Array<{ center?: [number, number] }>;
      };
      const center = data.features?.[0]?.center;
      if (!Array.isArray(center) || center.length < 2) return null;

      return timezoneFromCoordinates(center[1], center[0]);
    } catch {
      return null;
    }
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
      if (!formData.businessName) {
        setError('Business name is required');
        return false;
      }
      if (!formData.phone) {
        setError('Phone number is required');
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
      return 'Please fill in all required fields.';
    }
    return 'Unable to create account. Please check your information and try again.';
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError('');
    setNotice('');

    try {
      const payload = { ...formData };
      const locationTimezone = await resolveSubmittedTimezone();
      if (locationTimezone) {
        payload.timezone = locationTimezone;
      }
      if (!payload.timezone) {
        payload.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
      }

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(getFriendlyRegistrationError(data.error || 'Registration failed'));
      }

      setCurrentStep(4);
      setEmailVerified(false);
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
      setNotice('Email verified successfully. You can now log in.');
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

    if (currentStep === 3) {
      void handleSubmit();
      return;
    }

    setCurrentStep((prev) => (prev === 4 ? 4 : ((prev + 1) as Step)));
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
            <div className="w-8 sm:w-10 h-8 sm:h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl sm:text-2xl">C</span>
            </div>
            <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{APP_NAME}</span>
          </Link>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2">Start your 14-day free trial</p>
        </div>

        <div className="mb-6 sm:mb-8">
          <div className="flex items-start">
            {[
              { num: 1, label: 'Account' },
              { num: 2, label: 'Business' },
              { num: 3, label: 'Details' },
              { num: 4, label: 'Verify' },
            ].map((item, idx) => (
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
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-md mb-4 sm:mb-6 text-xs sm:text-sm">
              {error}
            </div>
          )}
          {notice && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-3 sm:px-4 py-2 sm:py-3 rounded-md mb-4 sm:mb-6 text-xs sm:text-sm">
              {notice}
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-3 sm:space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gray-900 dark:text-gray-100">Create Your Account</h2>

              {googleEnabled && (
                <button type="button" onClick={handleGoogleSignUp} className="btn-outline w-full">
                  Continue with Google
                </button>
              )}

              <div>
                <label htmlFor="email" className="label">Email Address *</label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData({ email: e.target.value })}
                  className="input"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="label">Password *</label>
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
                    <div className={`flex items-center ${passwordChecks.minLength ? 'text-success' : 'text-gray-500'}`}>
                      <span>At least 8 characters</span>
                    </div>
                    <div className={`flex items-center ${passwordChecks.hasNumber ? 'text-success' : 'text-gray-500'}`}>
                      <span>Contains a number</span>
                    </div>
                    <div className={`flex items-center ${passwordChecks.hasSpecialChar ? 'text-success' : 'text-gray-500'}`}>
                      <span>Contains a special character (!@#$%^&*)</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="label">Confirm Password *</label>
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
                  <Link href="/terms" target="_blank" className="text-primary hover:underline">Terms of Service</Link>{' '}
                  and{' '}
                  <Link href="/privacy" target="_blank" className="text-primary hover:underline">Privacy Policy</Link>
                </label>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-3 sm:space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gray-900 dark:text-gray-100">Tell Us About Your Business</h2>

              <div>
                <label htmlFor="businessName" className="label">Business Name *</label>
                <input
                  id="businessName"
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => updateFormData({ businessName: e.target.value })}
                  className="input"
                  placeholder="Acme Salon & Spa"
                  required
                />
              </div>

              <div>
                <label htmlFor="businessType" className="label">Business Type *</label>
                <select
                  id="businessType"
                  value={formData.businessType}
                  onChange={(e) => updateFormData({ businessType: e.target.value })}
                  className="input"
                  required
                >
                  {businessTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="phone" className="label">Business Phone *</label>
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateFormData({ phone: e.target.value })}
                  className="input"
                  placeholder="(555) 123-4567"
                  required
                />
              </div>

              <div>
                <label htmlFor="businessEmail" className="label">Business Email (optional)</label>
                <input
                  id="businessEmail"
                  type="email"
                  value={formData.businessEmail}
                  onChange={(e) => updateFormData({ businessEmail: e.target.value })}
                  className="input"
                  placeholder="Leave blank to use account email"
                />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Business Location</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                This information will be shown to customers booking appointments.
              </p>

              <div>
                <label htmlFor="street" className="label">Street Address</label>
                <AddressAutocomplete
                  defaultValue={formData.street}
                  placeholder="Start typing your business address..."
                  className="input"
                  onAddressSelect={(address: AddressComponents) => {
                    const latitude =
                      typeof address.latitude === 'number' ? address.latitude : null;
                    const longitude =
                      typeof address.longitude === 'number' ? address.longitude : null;
                    const locationTimezone =
                      latitude !== null && longitude !== null
                        ? timezoneFromCoordinates(latitude, longitude)
                        : null;

                    updateFormData({
                      street: address.street,
                      city: address.city,
                      state: address.state,
                      zipCode: address.zipCode,
                      country: address.country || 'United States',
                      ...(locationTimezone ? { timezone: locationTimezone } : {}),
                    });
                    setSelectedCoordinates(
                      latitude !== null && longitude !== null
                        ? {
                            latitude,
                            longitude,
                          }
                        : null
                    );
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="city" className="label">City</label>
                  <input
                    id="city"
                    type="text"
                    value={formData.city}
                    onChange={(e) => updateFormData({ city: e.target.value })}
                    className="input"
                    placeholder="San Francisco"
                  />
                </div>
                <div>
                  <label htmlFor="state" className="label">State/Province</label>
                  <input
                    id="state"
                    type="text"
                    value={formData.state}
                    onChange={(e) => updateFormData({ state: e.target.value })}
                    className="input"
                    placeholder="CA"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="zipCode" className="label">ZIP/Postal Code</label>
                  <input
                    id="zipCode"
                    type="text"
                    value={formData.zipCode}
                    onChange={(e) => updateFormData({ zipCode: e.target.value })}
                    className="input"
                    placeholder="94102"
                  />
                </div>
                <div>
                  <label htmlFor="country" className="label">Country</label>
                  <input
                    id="country"
                    type="text"
                    value={formData.country}
                    onChange={(e) => updateFormData({ country: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

            </div>
          )}

          {currentStep === 4 && (
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
                  <>Your account is now verified for <strong>{formData.email}</strong>.</>
                ) : (
                  <>We sent a 6-digit verification code to <strong>{formData.email}</strong>.</>
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
                <h3 className="font-semibold mb-3">Activation checklist</h3>
                <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <li>1. Open the verification email.</li>
                  <li>2. Enter the 6-digit verification code above.</li>
                  <li>3. Continue to login and access your dashboard.</li>
                </ul>
              </div>

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
                  {emailVerified ? 'Continue to Login' : 'Go to Login'}
                </Link>
              </div>
            </div>
          )}

          {currentStep < 4 && (
            <div className="flex justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              {currentStep > 1 ? (
                <button onClick={prevStep} className="btn-secondary" disabled={isLoading}>
                  Previous
                </button>
              ) : (
                <div />
              )}
              <button onClick={nextStep} className="btn-primary" disabled={isLoading}>
                {isLoading && currentStep === 3 ? 'Creating account...' : 'Next'}
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

