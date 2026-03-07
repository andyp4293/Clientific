'use client';

import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QRCodeCanvas } from 'qrcode.react';
import { Gift, Copy, Download, Users, DollarSign, Clock, CheckCircle } from 'lucide-react';

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

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Gift className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Refer &amp; Earn</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Earn <span className="font-semibold text-primary">$15 billing credit</span> for every business that subscribes using your link.
          They get <span className="font-semibold">30 extra free trial days</span>.
        </p>
      </div>

      {isLoading ? (
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      ) : (
        <>
          {/* Referral Link + QR */}
          <div className="card mb-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Your Referral Link</h2>
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Left: link + copy */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    value={referralUrl || 'Generating your link…'}
                    readOnly
                    className="input flex-1 text-sm bg-gray-50 dark:bg-gray-800"
                  />
                  <button onClick={copyLink} className="btn-outline flex items-center gap-1.5 shrink-0">
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Share this link anywhere — social media, email, or your website. Each signup tracks back to you automatically.
                </p>
                {/* How it works */}
                <div className="mt-4 space-y-2">
                  {[
                    'Share your unique link with another business owner',
                    'They sign up and get 30 extra free trial days',
                    'When they become a paying customer, you get $15 off your next bill',
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      {step}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: QR code */}
              {referralUrl && (
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div ref={canvasRef} className="bg-white p-2.5 rounded-lg border border-gray-200">
                    <QRCodeCanvas value={referralUrl} size={120} level="M" />
                  </div>
                  <button
                    onClick={downloadQr}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-primary transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download QR
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="card text-center">
              <div className="flex justify-center mb-1">
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                ${(data?.totalCredits ?? 0).toFixed(0)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Total earned</div>
            </div>
            <div className="card text-center">
              <div className="flex justify-center mb-1">
                <CheckCircle className="w-5 h-5 text-primary" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{creditedCount}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Credited</div>
            </div>
            <div className="card text-center">
              <div className="flex justify-center mb-1">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{pendingCount}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">In trial</div>
            </div>
          </div>

          {/* Referral list */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Your Referrals</h2>
            </div>

            {!data?.referrals.length ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Gift className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No referrals yet.</p>
                <p className="text-xs mt-1">Share your link to start earning.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.referrals.map(referral => (
                  <div key={referral.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {referral.referee.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Joined {new Date(referral.referee.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right">
                      {referral.status === 'credited' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle className="w-3 h-3" />
                          ${referral.creditAmount} credited
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
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

          {/* Fine print */}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 text-center">
            Credits apply automatically to your next invoice. No limit on referrals.
          </p>
        </>
      )}
    </div>
  );
}
