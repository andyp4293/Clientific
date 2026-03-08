'use client';

import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QRCodeCanvas } from 'qrcode.react';
import { Gift, Copy, Download, Users, CheckCircle, Clock, TrendingUp } from 'lucide-react';

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
}

export default function ReferralsPage() {
  const canvasRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<ReferralsData>({
    queryKey: ['referrals'],
    queryFn: () => fetch('/api/referrals').then(r => r.json()),
  });

  const referralUrl = typeof window !== 'undefined' && data?.referralCode
    ? `${window.location.origin}/register?ref=${data.referralCode}`
    : '';

  function copyLink() {
    navigator.clipboard.writeText(referralUrl);
    toast.success('Referral link copied!');
  }

  function downloadQr() {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clientific-referral-qr.png';
    a.click();
  }

  const creditedCount = data?.referrals.filter(r => r.status === 'credited').length ?? 0;
  const pendingCount = data?.referrals.filter(r => r.status === 'pending').length ?? 0;
  const totalCredits = data?.totalCredits ?? 0;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto pb-28 md:pb-8">

      {/* Hero banner */}
      <div className="rounded-2xl bg-gradient-to-br from-primary via-primary to-violet-700 p-6 mb-6 text-white shadow-lg shadow-primary/20">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
            <Gift className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Refer &amp; Earn</h1>
        </div>
        <p className="text-white/80 text-sm leading-relaxed mb-5">
          Invite another business owner to Clientific. When they become a paying subscriber, you get{' '}
          <span className="text-white font-semibold">$15 off your next bill</span> and they get{' '}
          <span className="text-white font-semibold">30 extra free days</span> to try it out.
        </p>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
            {isLoading ? (
              <div className="h-8 w-10 bg-white/20 rounded mx-auto mb-1 animate-pulse" />
            ) : (
              <div className="text-2xl font-bold">${totalCredits.toFixed(0)}</div>
            )}
            <div className="text-xs text-white/70 mt-0.5">Earned</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
            {isLoading ? (
              <div className="h-8 w-8 bg-white/20 rounded mx-auto mb-1 animate-pulse" />
            ) : (
              <div className="text-2xl font-bold">{creditedCount}</div>
            )}
            <div className="text-xs text-white/70 mt-0.5">Credited</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
            {isLoading ? (
              <div className="h-8 w-8 bg-white/20 rounded mx-auto mb-1 animate-pulse" />
            ) : (
              <div className="text-2xl font-bold">{pendingCount}</div>
            )}
            <div className="text-xs text-white/70 mt-0.5">In trial</div>
          </div>
        </div>
      </div>

      {/* Share card */}
      <div className="card p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Your referral link</h2>

        {/* Link input + copy */}
        <div className="flex items-center gap-2 mb-5">
          {isLoading || !referralUrl ? (
            <div className="flex-1 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ) : (
            <input
              type="text"
              value={referralUrl}
              readOnly
              className="input flex-1 text-sm bg-gray-50 dark:bg-gray-800/60 truncate"
            />
          )}
          <button
            onClick={copyLink}
            disabled={!referralUrl}
            className="flex items-center gap-1.5 text-sm font-medium bg-primary text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-lg transition-colors shrink-0"
          >
            <Copy className="w-4 h-4" />
            <span className="hidden sm:inline">Copy</span>
          </button>
        </div>

        {/* QR code — always rendered, skeleton when loading */}
        <div className="flex flex-col items-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Customers scan to sign up. Save to print on materials, cards, or social posts.
          </p>
          {isLoading || !referralUrl ? (
            <div className="w-[164px] h-[164px] bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ) : (
            <div ref={canvasRef} className="bg-white p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <QRCodeCanvas value={referralUrl} size={140} level="M" />
            </div>
          )}
          <button
            onClick={downloadQr}
            disabled={!referralUrl}
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
            'Share your unique link with another business owner',
            'They sign up and get 30 extra free trial days',
            'Once they subscribe, you automatically get $15 off your next bill',
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
          {data && data.referrals.length > 0 && (
            <span className="ml-auto text-xs text-gray-400">{data.referrals.length} total</span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
                <div className="space-y-1.5">
                  <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                  <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                </div>
                <div className="h-6 w-20 bg-gray-100 dark:bg-gray-800 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        ) : !data?.referrals.length ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
              <Gift className="w-7 h-7 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">No referrals yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Share your link to start earning credits.
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
                    Joined {new Date(referral.referee.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="shrink-0">
                  {referral.status === 'credited' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-100 dark:border-green-800/30">
                      <CheckCircle className="w-3 h-3" />
                      ${referral.creditAmount} earned
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
        Credits apply automatically to your next invoice. No limit on referrals.
      </p>
    </div>
  );
}
