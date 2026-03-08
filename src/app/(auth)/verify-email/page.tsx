'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { APP_NAME } from '@/lib/brand';

type VerifyState = 'checking' | 'success' | 'error' | 'missing';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<VerifyState>('checking');
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setState('missing');
        return;
      }

      try {
        const res = await fetch('/api/auth/verify-email/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body.error || 'Verification failed');
        }
        setState('success');
      } catch (error: any) {
        setState('error');
        setMessage(error.message || 'Verification failed');
      }
    };

    verify();
  }, [token]);

  const resendLink = async () => {
    if (!resendEmail) {
      setMessage('Enter your email to resend the verification link.');
      return;
    }

    setResending(true);
    setMessage('');
    try {
      const res = await fetch('/api/auth/verify-email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Could not resend verification email');
      }
      setMessage('If an account exists for that email, a new verification link has been sent.');
    } catch (error: any) {
      setMessage(error.message || 'Could not resend verification email');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Email Verification</h1>

        {state === 'checking' && (
          <p className="text-sm text-gray-600 dark:text-gray-300">Verifying your account...</p>
        )}

        {state === 'success' && (
          <>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              Your email has been verified. You can now sign in to {APP_NAME}.
            </p>
            <Link href="/login" className="btn-primary w-full text-center">
              Continue to Login
            </Link>
          </>
        )}

        {(state === 'error' || state === 'missing') && (
          <>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              {state === 'missing'
                ? 'This verification link is missing or incomplete.'
                : message || 'This verification link is invalid or expired.'}
            </p>
            <div className="space-y-3">
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="you@example.com"
                className="input"
              />
              <button
                type="button"
                onClick={resendLink}
                disabled={resending}
                className="btn-primary w-full"
              >
                {resending ? 'Sending...' : 'Resend Verification Email'}
              </button>
              <Link href="/login" className="btn-outline w-full text-center">
                Back to Login
              </Link>
            </div>
          </>
        )}

        {message && state !== 'success' && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{message}</p>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
