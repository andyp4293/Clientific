'use client';

import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QRCodeCanvas } from 'qrcode.react';
import { Gift, Copy, Download, Users, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { REFERRAL_COMMISSION_DISPLAY, STANDARD_TRIAL_DAYS } from '@/lib/referral-config';

interface Referral {
  id: string;
  createdAt: string;
  status: string;
  creditAmount: number;
  creditedAt: string | null;
  referee: { name: string; createdAt: string };
}

interface ReferralsData {
  referralCode: string | null;
  totalCredits: number;
  referrals: Referral[];
  payoutReady: boolean;
  payoutStatusCode: string;
  payoutSetupMessage: string | null;
}

export default function ReferralsPage() {
  const canvasRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<ReferralsData>({
    queryKey: ['referrals'],
    queryFn: () => fetch('/api/referrals').then(r => r.json()),
  });

  const referralUrl =
    typeof window !== 'undefined' && data?.referralCode
      ? `${window.location.origin}/register?ref=${data.referralCode}`
      : '';
  const payoutReady = data?.payoutReady ?? false;
  const sharingLocked = !isLoading && !payoutReady;
  const canShareReferralLink = Boolean(payoutReady && referralUrl);
  const payoutSetupMessage =
    data?.payoutSetupMessage ??
    'Finish payout setup before sharing your referral link so earnings can move into Stripe payouts automatically.';

  function copyLink() {
    if (!canShareReferralLink) return;
    navigator.clipboard.writeText(referralUrl);
    toast.success('Referral link copied!');
  }

  function downloadQr() {
    if (!canShareReferralLink) return;
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clientific-referral-qr.png';
    a.click();
  }

  const activeCount =
    data?.referrals?.filter(r => r.status === 'active' || r.status === 'credited').length ?? 0;
  const pendingCount = data?.referrals?.filter(r => r.status === 'pending').length ?? 0;
  const totalCredits = data?.totalCredits ?? 0;

  return (
    <div data-testid="referrals-page" className="p-4 md:p-6 max-w-2xl mx-auto pb-28 md:pb-8">
      {/* Hero banner */}
      <div className="brand-hero mb-6 rounded-2xl p-6 shadow-lg shadow-primary/20">
        <div className="flex items-center gap-2 mb-3">
          <div className="brand-hero-card flex h-9 w-9 items-center justify-center rounded-xl">
            <Gift className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-gray-950 dark:text-white">
            Refer &amp; Earn
          </h1>
        </div>
        <p className="brand-hero-muted mb-5 text-sm leading-relaxed">
          Once your payout setup is ready, you can share your referral link with another business
          owner. While they stay subscribed, you earn{' '}
          <span className="font-semibold text-gray-950 dark:text-white">
            {REFERRAL_COMMISSION_DISPLAY} every month
          </span>.
          Those earnings stack and move into your Stripe payout balance on the Payouts page.
        </p>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="brand-hero-card rounded-xl p-3 text-center">
            {isLoading ? (
              <div className="mx-auto mb-1 h-8 w-10 animate-pulse rounded bg-gray-200 dark:bg-white/20" />
            ) : (
              <div className="text-2xl font-bold text-gray-950 dark:text-white">
                ${totalCredits.toFixed(0)}
              </div>
            )}
            <div className="brand-hero-kicker mt-0.5 text-xs">Earned</div>
          </div>
          <div className="brand-hero-card rounded-xl p-3 text-center">
            {isLoading ? (
              <div className="mx-auto mb-1 h-8 w-8 animate-pulse rounded bg-gray-200 dark:bg-white/20" />
            ) : (
              <div className="text-2xl font-bold text-gray-950 dark:text-white">{activeCount}</div>
            )}
            <div className="brand-hero-kicker mt-0.5 text-xs">Active</div>
          </div>
          <div className="brand-hero-card rounded-xl p-3 text-center">
            {isLoading ? (
              <div className="mx-auto mb-1 h-8 w-8 animate-pulse rounded bg-gray-200 dark:bg-white/20" />
            ) : (
              <div className="text-2xl font-bold text-gray-950 dark:text-white">{pendingCount}</div>
            )}
            <div className="brand-hero-kicker mt-0.5 text-xs">In trial</div>
          </div>
        </div>
      </div>

      {/* Share card */}
      <div className="card p-5 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {sharingLocked ? 'Unlock referral sharing' : 'Your referral link'}
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {sharingLocked
                ? 'Referral links stay locked until Stripe payout setup is complete.'
                : 'Share this link or QR code once your payout setup is live.'}
            </p>
          </div>
          {sharingLocked && (
            <a href="/dashboard/payouts/setup" className="btn-primary text-sm">
              Finish Payout Setup
            </a>
          )}
        </div>

        {sharingLocked && (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-900/20">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Referral sharing is locked until payouts are ready
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              {payoutSetupMessage}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href="/dashboard/payouts/setup" className="btn-primary text-sm">
                Complete secure setup
              </a>
              <a href="/dashboard/payouts" className="btn-outline text-sm">
                View payout status
              </a>
            </div>
          </div>
        )}

        {/* Link input + copy */}
        <div className="flex items-center gap-2 mb-5">
          {isLoading ? (
            <div className="flex-1 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ) : canShareReferralLink ? (
            <input
              type="text"
              value={referralUrl}
              readOnly
              className="input flex-1 text-sm bg-gray-50 dark:bg-gray-800/60 truncate"
            />
          ) : (
            <input
              type="text"
              value="Referral sharing unlocks after payout setup is complete"
              readOnly
              disabled
              className="input flex-1 text-sm bg-gray-50 text-gray-400 dark:bg-gray-800/60 dark:text-gray-500"
            />
          )}
          <button
            onClick={copyLink}
            disabled={!canShareReferralLink}
            className="flex items-center gap-1.5 text-sm font-medium bg-primary text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-lg transition-colors shrink-0"
          >
            <Copy className="w-4 h-4" />
            <span className="hidden sm:inline">Copy</span>
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {sharingLocked
              ? 'Finish payout setup first, then save the QR code for cards, materials, and social posts.'
              : 'Business owners can scan to sign up. Save it to print on materials, cards, or social posts.'}
          </p>
          {isLoading ? (
            <div className="w-[164px] h-[164px] bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ) : canShareReferralLink ? (
            <div
              ref={canvasRef}
              className="bg-white p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
            >
              <QRCodeCanvas value={referralUrl} size={140} level="M" />
            </div>
          ) : (
            <div className="w-[164px] h-[164px] rounded-xl border border-dashed border-amber-300 bg-amber-50/80 p-4 text-center text-xs leading-relaxed text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/10 dark:text-amber-300 flex items-center justify-center">
              Finish payout setup to unlock your printable referral QR code.
            </div>
          )}
          <button
            onClick={downloadQr}
            disabled={!canShareReferralLink}
            className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Download QR Code
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">How it works</h2>
        </div>
        <div className="space-y-3">
          {[
            'Finish payout setup, then share your unique link with another business owner',
            `They sign up and get a free ${STANDARD_TRIAL_DAYS}-day trial`,
            `Once they subscribe, you automatically earn ${REFERRAL_COMMISSION_DISPLAY} of each paid subscription invoice, and those earnings stack in your payouts balance`,
          ].map((text, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Referral list */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Your referrals</h2>
          {data && data.referrals?.length > 0 && (
            <span className="ml-auto text-xs text-gray-400">{data.referrals.length} total</span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div
                key={i}
                className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700"
              >
                <div className="space-y-1.5">
                  <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                  <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                </div>
                <div className="h-6 w-20 bg-gray-100 dark:bg-gray-800 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        ) : !data?.referrals?.length ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
              <Gift className="w-7 h-7 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              No referrals yet
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Finish payout setup, then share your link to start earning credits.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {data.referrals.map(referral => (
              <div key={referral.id} className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {referral.referee.name}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Joined{' '}
                    {new Date(referral.referee.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="shrink-0">
                  {referral.status === 'active' || referral.status === 'credited' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-100 dark:border-green-800/30">
                      <CheckCircle className="w-3 h-3" />
                      ${referral.creditAmount.toFixed(2)} earned
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-100 dark:border-amber-800/30">
                      <Clock className="w-3 h-3" />
                      In trial
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 text-center leading-relaxed">
        Referral earnings are added automatically each month your referee stays subscribed. Once
        payout setup is complete, you can share freely, and completed earnings move into your
        Stripe payouts automatically.
      </p>
    </div>
  );
}
