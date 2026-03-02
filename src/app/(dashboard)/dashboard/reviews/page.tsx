'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

type Business = {
  googleReviewUrl: string | null;
  yelpUrl: string | null;
};

type SmsLog = {
  id: string;
  createdAt: string;
  to: string;
  status: string;
};

export default function ReviewsPage() {
  const { data: business } = useQuery<Business>({
    queryKey: ['business'],
    queryFn: async () => {
      const res = await fetch('/api/business');
      if (!res.ok) throw new Error('Failed to fetch business');
      return res.json();
    },
  });

  const { data: recentData, isLoading: recentLoading } = useQuery<{ logs: SmsLog[] }>({
    queryKey: ['reviews-recent'],
    queryFn: async () => {
      const res = await fetch('/api/reviews/recent');
      if (!res.ok) return { logs: [] };
      return res.json();
    },
  });

  const logs = recentData?.logs ?? [];
  const hasLinks = business?.googleReviewUrl || business?.yelpUrl;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Review Management</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Send review requests and track your reputation.</p>
      </div>

      {/* Your Review Links */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Your Review Links</h2>
        {!business ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
          </div>
        ) : hasLinks ? (
          <div className="space-y-3">
            {business.googleReviewUrl && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Google Reviews</p>
                  <a
                    href={business.googleReviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:text-primary-700 truncate block"
                  >
                    {business.googleReviewUrl}
                  </a>
                </div>
              </div>
            )}
            {business.yelpUrl && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Yelp</p>
                  <a
                    href={business.yelpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:text-primary-700 truncate block"
                  >
                    {business.yelpUrl}
                  </a>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No review links set.{' '}
            <a href="/dashboard/settings" className="text-primary hover:text-primary-700 font-medium">
              Add them in Settings → Integrations
            </a>
          </p>
        )}
      </div>

      {/* How to Request Reviews */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">How to Request Reviews</h2>
        <div className="flex gap-3">
          <div className="w-8 h-8 bg-primary-50 dark:bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            Go to any customer&apos;s profile and click <strong className="text-gray-900 dark:text-gray-100">Request Review</strong>. The button appears when the customer has a phone number, SMS consent, and you have at least one review link configured above.
          </p>
        </div>
      </div>

      {/* Recent Review Requests */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Review Requests</h2>
        {recentLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No review requests sent yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Phone</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {format(new Date(log.createdAt), 'MMM d, yyyy h:mm a')}
                    </td>
                    <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">
                      {log.to}
                    </td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.status === 'delivered'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                          : log.status === 'failed'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
