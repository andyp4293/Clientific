'use client';

import { Suspense, useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { APP_NAME } from '@/lib/brand';
import { ClientificLogo } from '@/components/brand/ClientificLogo';

function AuthRedirectScreen({ message }: { message: string }) {
  return (
    <div className="page-shell min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{message}</p>
      </div>
    </div>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [canResendVerification, setCanResendVerification] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';
  const oauthError = searchParams.get('error');

  // Redirect if already logged in
  useEffect(() => {
    if (status === 'authenticated' && !pendingRedirect) {
      const targetPath = '/dashboard';
      setPendingRedirect(targetPath);
      window.location.replace(targetPath);
    }
  }, [status, pendingRedirect]);

  useEffect(() => {
    if (!oauthError) return;
    setError(getFriendlyErrorMessage(oauthError));
    setCanResendVerification(oauthError.includes('EmailNotVerified'));
  }, [oauthError]);

  // Show loading while checking auth status
  if (status === 'loading') {
    return <AuthRedirectScreen message="Loading..." />;
  }

  if (status === 'authenticated' || pendingRedirect) {
    return <AuthRedirectScreen message="Signing you in..." />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setCanResendVerification(false);
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email: email.toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        // Convert technical errors to user-friendly messages
        const userFriendlyError = getFriendlyErrorMessage(result.error);
        setError(userFriendlyError);
        setCanResendVerification(result.error.includes('EmailNotVerified'));
      } else {
        setNotice('Signing you in...');
        const targetPath = '/dashboard';
        setPendingRedirect(targetPath);
        window.location.assign(targetPath);
      }
    } catch (err) {
      setError('Unable to connect to the server. Please try again later.');
      setCanResendVerification(false);
    } finally {
      setIsLoading(false);
    }
  };

  const getFriendlyErrorMessage = (error: string): string => {
    if (error.includes('EmailNotVerified')) {
      return 'Please verify your email before logging in. Use "Resend verification code" below if needed.';
    }
    if (error.includes('GoogleEmailNotVerified')) {
      return 'Your Google account email is not verified. Please verify it with Google first.';
    }
    if (error.includes('AccessDenied')) {
      return 'Sign-in was denied. Make sure your account exists and your email is verified.';
    }

    // Database connection errors
    if (error.includes('database') || error.includes('prisma') || error.includes('ECONNREFUSED')) {
      return 'Service temporarily unavailable. Please try again in a few moments.';
    }
    
    // Authentication errors
    if (error.includes('No account found')) {
      return 'No account found with this email address.';
    }
    
    if (error.includes('Incorrect password')) {
      return 'Incorrect password. Please try again.';
    }
    
    if (error.includes('Invalid credentials')) {
      return 'Invalid email or password.';
    }
    
    // Default friendly message
    return 'Login failed. Please check your credentials and try again.';
  };

  const handleResendVerification = async () => {
    if (!email) {
      setError('Enter your email address to resend the verification code.');
      return;
    }
    setIsResendingVerification(true);
    setNotice('');
    setError('');
    try {
      const res = await fetch('/api/auth/verify-email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Unable to resend verification code');
      }
      setNotice('If an account exists, we sent a new verification code to your inbox.');
    } catch (err: any) {
      setError(err.message || 'Unable to resend verification code');
    } finally {
      setIsResendingVerification(false);
    }
  };

  const handleGoogleSignIn = () => {
    setError('');
    setNotice('');
    void signIn('google', { callbackUrl: '/dashboard' });
  };

  return (    <div className="page-shell min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <Link href="/" className="inline-flex items-center space-x-2">
            <ClientificLogo
              className="inline-flex items-center gap-2"
              markClassName="h-8 w-8 sm:h-10 sm:w-10 text-gray-950 dark:text-white"
              nameClassName="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100"
              title={APP_NAME}
            />
          </Link>
        </div>

        {/* Login Card */}
        <div className="card p-6 sm:p-8">
          <h1 className="text-xl sm:text-2xl font-bold text-center mb-4 sm:mb-6 text-gray-900 dark:text-gray-100">Welcome Back</h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 px-4 py-3 rounded-md mb-4 text-sm">
              {error}
            </div>
          )}
          {notice && (
            <div className="bg-green-50 border border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300 px-4 py-3 rounded-md mb-4 text-sm">
              {notice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-primary focus:ring-primary mr-2"
                />
                <span className="text-gray-600 dark:text-gray-400">Remember me</span>
              </label>
              <Link href="/forgot-password" className="text-primary dark:text-primary-300 hover:text-primary-700 dark:hover:text-primary-200">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Log In'}
            </button>
          </form>

          {googleEnabled && (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="btn-outline mt-3 w-full"
              disabled={isLoading}
            >
              Continue with Google
            </button>
          )}

          {canResendVerification && (
            <div className="mt-3 flex flex-col items-start gap-2">
              <Link
                href={`/verify-email${email ? `?email=${encodeURIComponent(email.toLowerCase())}` : ''}`}
                className="text-sm font-medium text-primary dark:text-primary-300 hover:text-primary-700 dark:hover:text-primary-200"
              >
                Enter verification code
              </Link>
              <button
                type="button"
                onClick={handleResendVerification}
                className="text-sm font-medium text-primary dark:text-primary-300 hover:text-primary-700 dark:hover:text-primary-200"
                disabled={isResendingVerification}
              >
                {isResendingVerification ? 'Sending verification code...' : 'Resend verification code'}
              </button>
            </div>
          )}

          <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Don't have an account?{' '}
            <Link href="/register" className="text-primary dark:text-primary-300 hover:text-primary-700 dark:hover:text-primary-200 font-medium">
              Start your free trial
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}

