'use client';

import { useState } from 'react';
import Link from 'next/link';
import { APP_NAME } from '@/lib/brand';
import { PublicSiteHeader } from '@/components/layout/PublicSiteHeader';

export default function PartnerPage() {
  const [form, setForm] = useState({ name: '', email: '', payoutInfo: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const partnerUrl = result
    ? (typeof window !== 'undefined' ? `${window.location.origin}/register?aff=${result.code}` : '')
    : '';

  const handleCopy = () => {
    if (partnerUrl) {
      navigator.clipboard.writeText(partnerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/public/affiliate/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell min-h-screen">
      <PublicSiteHeader active="partner" />

      <main className="max-w-2xl mx-auto px-4 py-12 md:py-20">

        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            Partner Program
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Earn $15 for every business you refer
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
            No subscription needed. Share your unique link and earn $15 when the business you referred starts a paid subscription.
          </p>
          <p className="text-sm text-amber-600 dark:text-amber-400 font-medium mt-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-4 py-2 rounded-lg inline-block">
            You earn only when they subscribe and pay, not just for signing up.
          </p>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[
            { num: '1', title: 'Get your link', body: 'Sign up below and we send you a unique referral link in seconds.' },
            { num: '2', title: 'Share it', body: 'Send it to business owners, post it in Facebook groups, or add it to your website.' },
            { num: '3', title: 'Get paid', body: 'Once they start a paid plan (after any trial), we pay you $15 directly. No payment from them means no payout for you.' },
          ].map(({ num, title, body }) => (
            <div key={num} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold mb-3">
                {num}
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        {/* Form / Success state */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 md:p-8 shadow-sm">
          {result ? (
            /* Success */
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">You are all set!</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Your partner code is <span className="font-mono font-bold text-primary">{result.code}</span>. Share your link below to start earning.
              </p>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-4 flex items-center gap-2">
                <input
                  type="text"
                  value={partnerUrl}
                  readOnly
                  className="flex-1 bg-transparent text-sm text-gray-700 dark:text-gray-300 focus:outline-none truncate"
                />
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 transition-colors shrink-0"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
                Save this link. We will reach out using your payout details once a referred business makes their first payment. There is no limit on how many businesses you can refer.
              </p>
            </div>
          ) : (
            /* Sign-up form */
            <>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Create your partner account</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Takes 30 seconds. No credit card, no subscription required.</p>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Your name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="block w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-gray-800 dark:text-gray-100"
                    placeholder="Jane Smith"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Email address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    className="block w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-gray-800 dark:text-gray-100"
                    placeholder="jane@example.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Where should we send your earnings?
                  </label>
                  <input
                    type="text"
                    className="block w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-gray-800 dark:text-gray-100"
                    placeholder="e.g. PayPal: jane@example.com, Venmo: @jane, Zelle: 555-123-4567"
                    value={form.payoutInfo}
                    onChange={e => setForm(f => ({ ...f, payoutInfo: e.target.value }))}
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Optional now. You can update this before your first payout.</p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Creating your account...' : 'Get my referral link'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-6">
          Already a Clientific subscriber? Your referral link is inside your dashboard under Refer &amp; Earn.
        </p>
      </main>
    </div>
  );
}

