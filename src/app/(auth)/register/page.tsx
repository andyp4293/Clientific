'use client';

import { useState, Suspense, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import AddressAutocomplete from '@/components/ui/AddressAutocomplete';

type Step = 1 | 2 | 3 | 4;

interface FormData {
  // Step 1
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  
  // Step 2
  businessName: string;
  businessType: string;
  phone: string;
  businessEmail: string;
  
  // Step 3
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  timezone: string;
  
  // Step 4
  plan: string;
}

function RegisterForm() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const defaultPlan = searchParams.get('plan') || 'pro';
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  
  const [formData, setFormData] = useState<FormData>({
    email: '',
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
  });
  // Redirect if already logged in
  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [status, router]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }));
  }, []);

  // Password validation checks - memoized to recalculate when password changes
  // MUST be called before any conditional returns (Rules of Hooks)
  const passwordChecks = useMemo(() => ({
    minLength: formData.password.length >= 8,
    hasNumber: /[0-9]/.test(formData.password),
    hasSpecialChar: /[!@#$%^&*]/.test(formData.password),
    passwordsMatch: formData.password === formData.confirmPassword && formData.confirmPassword.length > 0,
  }), [formData.password, formData.confirmPassword]);

  // Show loading while checking auth status
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render registration form if authenticated
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
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const validateStep = (step: Step): boolean => {
    setError('');
    
    switch (step) {
      case 1:
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
        
      case 2:
        if (!formData.businessName) {
          setError('Business name is required');
          return false;
        }
        if (!formData.phone) {
          setError('Phone number is required');
          return false;
        }
        return true;
        
      case 3:
        // Optional fields, always valid
        return true;
        
      default:
        return true;
    }
  };  const nextStep = async () => {
    if (validateStep(currentStep)) {
      // Check email availability before moving from step 1
      if (currentStep === 1) {
        setIsLoading(true);
        const emailAvailable = await checkEmailAvailability(formData.email);
        setIsLoading(false);
        
        if (!emailAvailable) {
          setError('An account with this email already exists. Please log in instead.');
          return;
        }
      }
      
      // If moving from step 3 to step 4, create the account first
      if (currentStep === 3) {
        handleSubmit();
      } else {
        setCurrentStep((prev) => Math.min(prev + 1, 4) as Step);
      }
    }
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
    } catch (err) {
      // On error, allow user to proceed (fail gracefully)
      console.error('Email check failed:', err);
      return true;
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1) as Step);
  };  const handleSubmit = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        const friendlyError = getFriendlyRegistrationError(data.error || 'Registration failed');
        throw new Error(friendlyError);
      }

      // Account created successfully, move to step 4
      setCurrentStep(4);
      setIsLoading(false);
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
      // Stay on step 3 so user can see the error
    }
  };

  const handleDashboardRedirect = async () => {
    setIsLoading(true);

    try {
      // Auto-login after registration
      const { signIn } = await import('next-auth/react');
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError('Account created but login failed. Please try logging in manually.');
        setIsLoading(false);
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError('Account created but login failed. Please try logging in manually.');
      setIsLoading(false);
    }
  };

  const handleSubscribeRedirect = async () => {
    setIsLoading(true);

    try {
      // Auto-login first so the checkout API can read the session
      const { signIn } = await import('next-auth/react');
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError('Login failed. Please go to the dashboard and subscribe from billing settings.');
        setIsLoading(false);
        return;
      }

      // Now trigger checkout for the selected plan
      router.push(`/pricing?autostart=${formData.plan}`);
      router.refresh();
    } catch {
      setError('Something went wrong. Please subscribe from the billing settings page.');
      setIsLoading(false);
    }
  };

  const getFriendlyRegistrationError = (error: string): string => {
    // Database connection errors
    if (error.includes('database') || error.includes('prisma') || error.includes('ECONNREFUSED')) {
      return 'Service temporarily unavailable. Please try again in a few moments.';
    }
    
    // Duplicate email
    if (error.includes('already exists') || error.includes('duplicate') || error.includes('unique constraint')) {
      return 'An account with this email already exists. Please log in instead.';
    }
    
    // Missing fields
    if (error.includes('required') || error.includes('Missing')) {
      return 'Please fill in all required fields.';
    }
    
    // Default friendly message
    return 'Unable to create account. Please check your information and try again.';
  };

  return (    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 sm:py-12 px-4">
      <div className="w-full max-w-2xl mx-auto">
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <Link href="/" className="inline-flex items-center space-x-2">
            <div className="w-8 sm:w-10 h-8 sm:h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl sm:text-2xl">C</span>
            </div>
            <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Clientell</span>
          </Link>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2">Start your 14-day free trial</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-6 sm:mb-8">
          <div className="flex justify-between items-center">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div
                  className={`w-8 sm:w-10 h-8 sm:h-10 rounded-full flex items-center justify-center font-medium text-sm sm:text-base ${
                    step <= currentStep
                      ? 'bg-primary text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {step}
                </div>
                {step < 4 && (
                  <div
                    className={`flex-1 h-0.5 sm:h-1 mx-1 sm:mx-2 ${
                      step < currentStep ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">
            <span>Account</span>
            <span>Business</span>
            <span>Details</span>
            <span>Complete</span>
          </div>
        </div>        {/* Registration Card */}
        <div className="card p-4 sm:p-6 lg:p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-md mb-4 sm:mb-6 text-xs sm:text-sm">
              {error}
            </div>
          )}          {/* Step 1: Account Creation */}
          {currentStep === 1 && (
            <div className="space-y-3 sm:space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gray-900 dark:text-gray-100">Create Your Account</h2>
              
              <div>
                <label htmlFor="email" className="label">
                  Email Address *
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
              </div>              <div>
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
                
                {/* Password Requirements Checklist */}
                {(passwordFocused || formData.password.length > 0) && (
                  <div className="mt-3 space-y-2 text-sm">
                    <div className={`flex items-center ${passwordChecks.minLength ? 'text-success' : 'text-gray-500'}`}>
                      {passwordChecks.minLength ? (
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <circle cx="10" cy="10" r="3" />
                        </svg>
                      )}
                      <span>At least 8 characters</span>
                    </div>
                    <div className={`flex items-center ${passwordChecks.hasNumber ? 'text-success' : 'text-gray-500'}`}>
                      {passwordChecks.hasNumber ? (
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <circle cx="10" cy="10" r="3" />
                        </svg>
                      )}
                      <span>Contains a number</span>
                    </div>
                    <div className={`flex items-center ${passwordChecks.hasSpecialChar ? 'text-success' : 'text-gray-500'}`}>
                      {passwordChecks.hasSpecialChar ? (
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <circle cx="10" cy="10" r="3" />
                        </svg>
                      )}
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
                
                {/* Password Match Indicator */}
                {formData.confirmPassword.length > 0 && (
                  <div className={`mt-2 text-sm flex items-center ${passwordChecks.passwordsMatch ? 'text-success' : 'text-red-600'}`}>
                    {passwordChecks.passwordsMatch ? (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span>Passwords match</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        <span>Passwords do not match</span>
                      </>
                    )}
                  </div>
                )}
              </div>              <div className="flex items-start">
                <input
                  id="acceptTerms"
                  type="checkbox"
                  checked={formData.acceptTerms}
                  onChange={(e) => updateFormData({ acceptTerms: e.target.checked })}
                  className="rounded border-gray-300 text-primary focus:ring-primary mr-3 mt-1"
                />
                <label htmlFor="acceptTerms" className="text-sm text-gray-600 dark:text-gray-400">
                  I accept the{' '}
                  <Link href="/terms" target="_blank" className="text-primary hover:underline">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" target="_blank" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>
                </label>
              </div>
            </div>
          )}          {/* Step 2: Business Information */}
          {currentStep === 2 && (
            <div className="space-y-3 sm:space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gray-900 dark:text-gray-100">Tell Us About Your Business</h2>

              <div>
                <label htmlFor="businessName" className="label">
                  Business Name *
                </label>
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
                <label htmlFor="businessType" className="label">
                  Business Type *
                </label>
                <select
                  id="businessType"
                  value={formData.businessType}
                  onChange={(e) => updateFormData({ businessType: e.target.value })}
                  className="input"
                  required
                >
                  {businessTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="phone" className="label">
                  Business Phone *
                </label>
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
                <label htmlFor="businessEmail" className="label">
                  Business Email (optional)
                </label>
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

          {/* Step 3: Business Details */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Business Location</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                This information will be shown to customers booking appointments.
              </p>              <div>
                <label htmlFor="street" className="label">
                  Street Address
                </label>
                <AddressAutocomplete
                  defaultValue={formData.street}
                  placeholder="Start typing your business address..."
                  className="input"
                  onAddressSelect={(address) => {
                    updateFormData({
                      street: address.street,
                      city: address.city,
                      state: address.state,
                      zipCode: address.zipCode,
                      country: address.country,
                    });
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="city" className="label">
                    City
                  </label>
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
                  <label htmlFor="state" className="label">
                    State/Province
                  </label>
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
                  <label htmlFor="zipCode" className="label">
                    ZIP/Postal Code
                  </label>
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
                  <label htmlFor="country" className="label">
                    Country
                  </label>
                  <input
                    id="country"
                    type="text"
                    value={formData.country}
                    onChange={(e) => updateFormData({ country: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="timezone" className="label">
                  Timezone
                </label>
                <input
                  id="timezone"
                  type="text"
                  value={formData.timezone}
                  onChange={(e) => updateFormData({ timezone: e.target.value })}
                  className="input"
                  readOnly
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Auto-detected from your browser</p>
              </div>
            </div>
          )}

          {/* Step 4: Complete */}
          {currentStep === 4 && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-success rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              
              <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">You're All Set!</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Your account has been created. Your 14-day free trial starts now.
              </p>

              <div className="card bg-primary-50 p-6 text-left mb-8">
                <h3 className="font-semibold mb-4">What's Next?</h3>
                <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-primary mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Check in your first customer</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-primary mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Set up your services and business hours</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-primary mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Enable online booking for customers</span>
                  </li>                </ul>
              </div>              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {formData.plan && formData.plan !== 'trial' && (
                  <button
                    onClick={handleSubscribeRedirect}
                    className="btn-primary px-8 py-3 text-lg"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Please wait...' : 'Subscribe Now'}
                  </button>
                )}
                <button
                  onClick={handleDashboardRedirect}
                  className={formData.plan && formData.plan !== 'trial' ? 'btn-outline px-8 py-3 text-base' : 'btn-primary px-8 py-3 text-lg'}
                  disabled={isLoading}
                >
                  {isLoading ? 'Logging you in...' : formData.plan && formData.plan !== 'trial' ? 'Skip — use free trial' : 'Go to Dashboard'}
                </button>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          {currentStep < 4 && (
            <div className="flex justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">              {currentStep > 1 ? (
                <button onClick={prevStep} className="btn-secondary" disabled={isLoading}>
                  ← Previous
                </button>
              ) : (
                <div />
              )}
              <button onClick={nextStep} className="btn-primary" disabled={isLoading}>
                {isLoading && currentStep === 3 ? 'Creating account...' : 'Next →'}
              </button>
            </div>
          )}
        </div>        {/* Login Link */}
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
