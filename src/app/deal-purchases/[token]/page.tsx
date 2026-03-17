'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { PublicSiteHeader } from '@/components/layout/PublicSiteHeader';

interface DealPurchaseResponse {
  purchase: {
    id: string;
    token: string;
    status: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string | null;
    subtotalAmount: number;
    discountAmount: number;
    totalAmount: number;
    applicationFeeAmount: number;
    businessNetAmount: number;
    stripeReceiptUrl: string | null;
    redemptionCode: string | null;
    purchasedAt: string | null;
    redeemedAt: string | null;
    expiresAt: string | null;
    deal: {
      id: string;
      title: string;
      description: string | null;
      discountType: string;
      discountValue: number;
    };
    business: {
      name: string;
      slug: string;
      publicId: string;
      city: string | null;
      state: string | null;
    };
    items: Array<{
      id: string;
      serviceName: string;
      quantity: number;
      originalUnitAmount: number;
      discountedUnitAmount: number;
    }>;
  };
}

function formatCents(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount / 100);
}

export default function DealPurchaseReceiptPage() {
  const params = useParams();
  const token = params.token as string;
  const { data: session } = useSession();

  const { data, isLoading, isError } = useQuery<DealPurchaseResponse>({
    queryKey: ['deal-purchase', token],
    queryFn: async () => {
      const res = await fetch(`/api/public/deal-purchases/${token}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Purchase not found');
      }
      return res.json();
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="page-shell min-h-screen">
        <PublicSiteHeader active="deal" showLogin={false} showCta={false} />
        <div className="flex items-center justify-center px-4 py-20">
          <p className="text-sm text-gray-600 dark:text-gray-300">Loading receipt...</p>
        </div>
      </div>
    );
  }

  if (isError || !data?.purchase) {
    return (
      <div className="page-shell min-h-screen">
        <PublicSiteHeader active="deal" showLogin={false} showCta={false} />
        <div className="flex items-center justify-center px-4 py-20">
          <div className="max-w-md w-full rounded-2xl border border-gray-200 bg-white p-6 text-center dark:border-gray-700 dark:bg-gray-800">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Receipt unavailable</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              We could not find that deal purchase.
            </p>
            <Link href="/explore" className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline">
              Browse active deals
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { purchase } = data;

  return (
    <div className="page-shell min-h-screen">
      <PublicSiteHeader active="deal" showLogin={false} showCta={false} />
      <div className="px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-4">
          {session && (
            <Link href="/dashboard/campaigns" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
              <span aria-hidden="true">&larr;</span> Back to deals
            </Link>
          )}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                  Deal receipt
                </p>
                <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {purchase.deal.title}
                </h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  Purchased from {purchase.business.name}
                </p>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-primary">Redemption code</p>
                <p className="mt-2 font-mono text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {purchase.redemptionCode ?? 'Processing'}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Customer</p>
                <p className="mt-2 font-semibold text-gray-900 dark:text-gray-100">{purchase.customerName}</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{purchase.customerPhone}</p>
                {purchase.customerEmail && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{purchase.customerEmail}</p>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Status</p>
                <p className="mt-2 font-semibold capitalize text-gray-900 dark:text-gray-100">
                  {purchase.status}
                </p>
                {purchase.purchasedAt && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    Purchased{' '}
                    {new Date(purchase.purchasedAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                )}
                {purchase.redeemedAt && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    Redeemed{' '}
                    {new Date(purchase.redeemedAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                Purchased services
              </p>
              <div className="mt-4 space-y-3">
                {purchase.items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{item.serviceName}</p>
                      <p className="mt-1 text-gray-500 dark:text-gray-400">
                        Original {formatCents(item.originalUnitAmount)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {formatCents(item.discountedUnitAmount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2 border-t border-gray-200 pt-4 dark:border-gray-700">
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                  <span>Subtotal</span>
                  <span>{formatCents(purchase.subtotalAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-primary">
                  <span>Deal discount</span>
                  <span>-{formatCents(purchase.discountAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-base font-semibold text-gray-900 dark:text-gray-100">
                  <span>Total paid</span>
                  <span>{formatCents(purchase.totalAmount)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {purchase.stripeReceiptUrl && (
                <a
                  href={purchase.stripeReceiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
                >
                  Open Stripe receipt
                </a>
              )}
              <Link
                href={`/business/${purchase.business.publicId}`}
                className="inline-flex rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-900 hover:border-primary hover:text-primary dark:border-gray-700 dark:text-gray-100"
              >
                View business
              </Link>
              <Link
                href={purchase.business.city ? `/explore?location=${encodeURIComponent(purchase.business.city)}` : '/explore'}
                className="inline-flex rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-900 hover:border-primary hover:text-primary dark:border-gray-700 dark:text-gray-100"
              >
                Find more deals
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
