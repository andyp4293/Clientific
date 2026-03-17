'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { APP_NAME } from '@/lib/brand';

type VerifyState = 'idle' | 'checking' | 'success' | 'error';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const prefilledEmail = searchParams.get('email') || '';

  const [state, setState] = useState<VerifyState>('idle');
  const [email, setEmail] = useState(prefilledEmail);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    setEmail(prefilledEmail);
  }, [prefilledEmail]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const verifyLegacyToken = async () => {
      setState('checking');
      setMessage('');
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
        setMessage('Your email has been verified. You can now sign in.');
      } catch (error: any) {
        setState('error');
        setMessage(error.message || 'Verification failed');
      }
    };

    void verifyLegacyToken();
  }, [token]);

  const verifyCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const cleanedCode = code.replace(/\D/g, '');
    if (!normalizedEmail || cleanedCode.length !== 6) {
      setState('error');
      setMessage('Enter your email and 6-digit verification code.');
      return;
    }

    setState('checking');
    setMessage('');
    try {
      const res = await fetch('/api/auth/verify-email/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, code: cleanedCode }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Verification failed');
      }
      setState('success');
      setMessage('Your email has been verified. You can now sign in.');
    } catch (error: any) {
      setState('error');
      setMessage(error.message || 'Verification failed');
    }
  };

  const resendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setState('error');
      setMessage('Enter your email to resend the verification code.');
      return;
    }

    setResending(true);
    setMessage('');
    try {
      const res = await fetch('/api/auth/verify-email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Could not resend verification code');
      }
      setState('idle');
      setMessage('If an account exists for that email, a new verification code has been sent.');
    } catch (error: any) {
      setState('error');
      setMessage(error.message || 'Could not resend verification code');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="page-shell min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Email Verification</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Enter your 6-digit code to continue to {APP_NAME}.
        </p>

        {state === 'checking' && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Verifying your account...</p>
        )}

        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input"
            disabled={state === 'checking' || state === 'success'}
          />
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="input text-center tracking-[0.35em] font-semibold"
            disabled={state === 'checking' || state === 'success'}
          />
          <button
            type="button"
            onClick={verifyCode}
            disabled={state === 'checking' || state === 'success'}
            className="btn-primary w-full"
          >
            {state === 'checking' ? 'Verifying...' : 'Verify Code'}
          </button>
          <button
            type="button"
            onClick={resendCode}
            disabled={resending || state === 'checking' || state === 'success'}
            className="btn-outline w-full"
          >
            {resending ? 'Sending...' : 'Resend verification code'}
          </button>
          <Link href="/login" className="btn-outline w-full text-center">
            Back to Login
          </Link>
        </div>

        {message && (
          <p
            className={`mt-3 text-xs ${
              state === 'error' ? 'text-red-600 dark:text-red-400' : state === 'success' ? 'text-green-600 dark:text-green-400' : 'text-gray-500'
            }`}
          >
            {message}
          </p>
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

