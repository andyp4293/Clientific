'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { PublicSiteHeader } from '@/components/layout/PublicSiteHeader';

interface DealResponse {
  deal: {
    id: string;
    title: string;
    description: string | null;
    discountType: string;
    discountValue: number;
    startsAt: string;
    expiresAt: string;
    service: { name: string } | null;
    business: {
      name: string;
      slug: string;
      publicId: string;
      city: string | null;
      state: string | null;
    };
  };
}

function discountLabel(type: string, value: number): string {
  if (type === 'percent_off') return `${value}% off`;
  if (type === 'amount_off') return `$${value.toFixed(2)} off`;
  return 'Free service';
}

export default function PublicDealClaimPage() {
  const params = useParams();
  const dealId = params.dealId as string;
  const [customerPhone, setCustomerPhone] = useState('');
  const [claimCode, setClaimCode] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<DealResponse>({
    queryKey: ['public-deal', dealId],
    queryFn: async () => {
      const res = await fetch(`/api/public/deals/${dealId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Deal not found');
      }
      return res.json();
    },
    enabled: !!dealId,
  });

  const phoneReady = useMemo(() => customerPhone.replace(/\D/g, '').length >= 10, [customerPhone]);

  const claimDeal = async () => {
    setIsClaiming(true);
    setClaimError(null);
    setClaimCode(null);

    try {
      const res = await fetch(`/api/public/deals/${dealId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerPhone }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not claim this deal');
      }
      const body = await res.json();
      setClaimCode(body.code);
    } catch (error: any) {
      setClaimError(error?.message || 'Could not claim this deal');
    } finally {
      setIsClaiming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <PublicSiteHeader active="deal" />
        <div className="flex items-center justify-center px-4 py-20">
          <p className="text-sm text-gray-600 dark:text-gray-300">Loading deal...</p>
        </div>
      </div>
    );
  }

  if (isError || !data?.deal) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <PublicSiteHeader active="deal" />
        <div className="flex items-center justify-center px-4 py-20">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Deal unavailable</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              This promotion is no longer active.
            </p>
            <Link href="/explore" className="text-sm font-medium text-primary hover:underline">
              Browse active deals
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { deal } = data;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PublicSiteHeader active="deal" />
      <div className="py-8 px-4">
        <div className="max-w-xl mx-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-6 space-y-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
              {deal.business.name}
            </p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{deal.title}</h1>
            <p className="inline-block bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-sm font-semibold px-2.5 py-1 rounded">
              {discountLabel(deal.discountType, deal.discountValue)}
            </p>
            {deal.description && (
              <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">{deal.description}</p>
            )}
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {deal.service?.name ?? 'Any service'} • Expires{' '}
              {new Date(deal.expiresAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium">
            <Link href={`/business/${deal.business.publicId}`} className="text-primary hover:underline">
              View business profile
            </Link>
            <Link
              href={deal.business.city ? `/explore?location=${encodeURIComponent(deal.business.city)}` : '/explore'}
              className="text-primary hover:underline"
            >
              Find more deals nearby
            </Link>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Mobile Phone (required to claim)
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              By claiming, you consent to receive deal redemption details by text. Reply STOP to opt out, HELP for help.
            </p>
            <button
              type="button"
              onClick={claimDeal}
              disabled={!phoneReady || isClaiming}
              className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClaiming ? 'Claiming...' : 'Claim Deal Code'}
            </button>
            {claimError && <p className="text-sm text-red-600 dark:text-red-400">{claimError}</p>}
          </div>

          {claimCode && (
            <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
              <p className="text-sm text-green-800 dark:text-green-300 mb-1">Your code is ready:</p>
              <p className="font-mono text-lg font-bold text-green-900 dark:text-green-200">{claimCode}</p>
              <p className="text-xs text-green-800 dark:text-green-300 mt-2">
                Show this code at checkout for redemption.
              </p>
              <Link
                href={`/book/${deal.business.publicId}`}
                className="inline-block mt-4 text-sm font-medium text-primary hover:underline"
              >
                Optional: Book now
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
