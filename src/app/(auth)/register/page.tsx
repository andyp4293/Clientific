'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

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

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultPlan = searchParams.get('plan') || 'pro';

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
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
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    plan: defaultPlan,
  });

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
        if (!/(?=.*[0-9])(?=.*[!@#$%^&*])/.test(formData.password)) {
          setError('Password must include a number and special character');
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
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4) as Step);
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1) as Step);
  };

  const handleSubmit = async () => {
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
        throw new Error(data.error || 'Registration failed');
      }

      // Auto-login after registration
      const { signIn } = await import('next-auth/react');
      await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-100 py-12 px-4">
      <div className="w-full max-w-2xl mx-auto">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-2xl">C</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">ClientFlow</span>
          </Link>
          <p className="text-gray-600 mt-2">Start your 14-day free trial</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                    step <= currentStep
                      ? 'bg-primary text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step}
                </div>
                {step < 4 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      step < currentStep ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-600">
            <span>Account</span>
            <span>Business</span>
            <span>Details</span>
            <span>Complete</span>
          </div>
        </div>

        {/* Registration Card */}
        <div className="card p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Account Creation */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold mb-6">Create Your Account</h2>
              
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
                  className="input"
                  placeholder="Min. 8 characters with number & special character"
                  required
                />
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
                <label htmlFor="acceptTerms" className="text-sm text-gray-600">
                  I accept the{' '}
                  <a href="#" className="text-primary hover:underline">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="#" className="text-primary hover:underline">
                    Privacy Policy
                  </a>
                </label>
              </div>
            </div>
          )}

          {/* Step 2: Business Information */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold mb-6">Tell Us About Your Business</h2>

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
              <h2 className="text-2xl font-bold mb-6">Business Location</h2>
              <p className="text-sm text-gray-600 mb-4">
                This information will be shown to customers booking appointments.
              </p>

              <div>
                <label htmlFor="street" className="label">
                  Street Address
                </label>
                <input
                  id="street"
                  type="text"
                  value={formData.street}
                  onChange={(e) => updateFormData({ street: e.target.value })}
                  className="input"
                  placeholder="123 Main Street"
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
                <p className="text-xs text-gray-500 mt-1">Auto-detected from your browser</p>
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
              
              <h2 className="text-3xl font-bold mb-4">You're All Set!</h2>
              <p className="text-gray-600 mb-8">
                Your account has been created. Your 14-day free trial starts now.
              </p>

              <div className="card bg-primary-50 p-6 text-left mb-8">
                <h3 className="font-semibold mb-4">What's Next?</h3>
                <ul className="space-y-2 text-sm text-gray-700">
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
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-primary mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Configure automatic review requests</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={handleSubmit}
                className="btn-primary px-8 py-3 text-lg"
                disabled={isLoading}
              >
                {isLoading ? 'Setting up your account...' : 'Go to Dashboard'}
              </button>
            </div>
          )}

          {/* Navigation Buttons */}
          {currentStep < 4 && (
            <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
              {currentStep > 1 ? (
                <button onClick={prevStep} className="btn-secondary">
                  ← Previous
                </button>
              ) : (
                <div />
              )}
              <button onClick={nextStep} className="btn-primary">
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Login Link */}
        <div className="text-center mt-6 text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:text-primary-700 font-medium">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
