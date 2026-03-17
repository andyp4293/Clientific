'use client';

import { useState } from 'react';

interface Deal {
  id: string;
  title: string;
  discountType: string;
  discountValue: number;
}

interface Props {
  business: { slug: string; publicId: string | null; name: string };
  deals: Deal[];
  appUrl: string;
}

function discountLabel(type: string, value: number) {
  if (type === 'percent_off') return `${value}% off`;
  if (type === 'amount_off') return `$${value.toFixed(2)} off`;
  return 'Free';
}

function ExternalLinkIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

interface PreviewCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  url: string;
  urlLabel?: string;
  badge?: string;
  children?: React.ReactNode;
}

function PreviewCard({ icon, title, description, url, urlLabel, badge, children }: PreviewCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/15 text-primary dark:text-primary-300">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            {badge && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 dark:bg-primary/15 text-primary dark:text-primary-300 font-medium">
                {badge}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{description}</p>

          {children}

          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 min-w-0 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-600 dark:text-gray-400 truncate font-mono">
              {urlLabel ?? url}
            </div>
            <button
              onClick={handleCopy}
              className="shrink-0 px-3 py-2 text-xs font-medium border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-500 transition-colors"
            >
              Open
              <ExternalLinkIcon />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerViewPage({ business, deals, appUrl }: Props) {
  const base = appUrl.replace(/\/$/, '');
  const bookingUrl = `${base}/book/${business.publicId ?? business.slug}`;
  const profileUrl = `${base}/business/${business.publicId}`;
  const exploreUrl = `${base}/explore`;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Customer View</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          See exactly what your customers see when they interact with {business.name} on Clientific.
        </p>
      </div>

      {/* Booking Page */}
      <PreviewCard
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        }
        title="Booking Page"
        description="Where customers book appointments. Share this link in your bio, receipts, or anywhere you want customers to book."
        url={bookingUrl}
        badge="Share this"
      />

      {/* Business Profile */}
      <PreviewCard
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        }
        title="Business Profile"
        description="Your public profile page showing your services, hours, contact info, and reviews. Customers can find this when browsing or clicking a link."
        url={profileUrl}
      />

      {/* Explore / Deals Discovery */}
      <PreviewCard
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        }
        title="Deals Discovery Page"
        description="The public page where customers search for deals near them across all Clientific businesses. Your active deals appear here."
        url={exploreUrl}
      />

      {/* Individual Deals */}
      {deals.length > 0 && (
        <div className="card p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/15 text-primary dark:text-primary-300">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 8V5a2 2 0 012-2h2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Your Active Deals</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Each deal has its own purchase page customers land on when they click your deal.
              </p>
              <div className="space-y-2">
                {deals.map((deal) => {
                  const dealUrl = `${base}/d/${deal.id}`;
                  return (
                    <DealRow key={deal.id} deal={deal} url={dealUrl} />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {deals.length === 0 && (
        <div className="card p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 8V5a2 2 0 012-2h2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">No Active Deals</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                You don&apos;t have any active deals right now. Create one in{' '}
                <a href="/dashboard/campaigns" className="text-primary dark:text-primary-300 hover:underline font-medium">
                  Deals
                </a>{' '}
                to see your deal pages here.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DealRow({ deal, url }: { deal: Deal; url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 py-2 border-t border-gray-100 dark:border-gray-800 first:border-t-0 first:pt-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{deal.title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{discountLabel(deal.discountType, deal.discountValue)}</p>
      </div>
      <button
        onClick={handleCopy}
        className="shrink-0 px-2.5 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-500 transition-colors"
      >
        Open
        <ExternalLinkIcon />
      </a>
    </div>
  );
}
