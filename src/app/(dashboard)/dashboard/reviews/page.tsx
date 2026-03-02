'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import Link from 'next/link';

interface SmsLog {
  id: string;
  createdAt: string;
  toPhone: string;
  status: string;
}

interface Business {
  googleReviewUrl: string | null;
  yelpUrl: string | null;
}

export default function ReviewsPage() {
  const { data: businessData } = useQuery({
    queryKey: ['business-info'],
    queryFn: async () => {
      const res = await fetch('/api/business');
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: recentData, isLoading } = useQuery({
    queryKey: ['reviews-recent'],
    queryFn: async () => {
      const res = await fetch('/api/reviews/recent');
      if (!res.ok) return { logs: [] };
      return res.json();
    },
  });

  const business: Business | null = businessData?.business ?? null;
  const logs: SmsLog[] = recentData?.logs ?? [];
  const hasReviewLinks = !!(business?.googleReviewUrl || business?.yelpUrl);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Review Management</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Request reviews from customers and track your review links.</p>
      </div>

      {/* Review Links Card */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Your Review Links</h2>
        {hasReviewLinks ? (
          <div className="space-y-3">
            {business?.googleReviewUrl && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <svg className="w-5 h-5 text-blue-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Google Reviews</p>
                  <a href={business.googleReviewUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate block">
                    {business.googleReviewUrl}
                  </a>
                </div>
              </div>
            )}
            {business?.yelpUrl && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21.111 18.226c-.141.969-2.119 3.483-3.029 3.847-.311.124-.611.094-.838-.09-.154-.122-.314-.361-1.241-1.924l-.141-.239c-.498-.848-.949-1.616-.949-2.284 0-.604.276-1.156.746-1.514.351-.269.745-.403 1.152-.403.247 0 .497.047.743.143C18.743 16.26 20.948 17 21.051 17c.347.074.688.32.714.692.012.173-.048.37-.654.534zm-4.893 5.77c-.143.002-.283 0-.423-.009C9.434 23.509 4.75 18.826 4.75 12.998 4.75 7.17 9.434 2.488 15.262 2.488c5.828 0 10.512 4.682 10.512 10.51 0 1.754-.43 3.408-1.185 4.869-.246.471-.793.651-1.281.44a.777.777 0 01-.447-.634c-.013-.19.024-.387.11-.567.603-1.218.942-2.59.942-4.108 0-5.008-4.007-9.015-9.015-9.015-5.007 0-9.015 4.007-9.015 9.015 0 5.008 4.008 9.016 9.015 9.016 1.12 0 2.193-.202 3.183-.568a.776.776 0 01.996.465.776.776 0 01-.465.996c-.001.001-.001.001-.001.001-.942.34-1.954.534-3.009.538h-.39z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Yelp</p>
                  <a href={business.yelpUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate block">
                    {business.yelpUrl}
                  </a>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              No review links configured.{' '}
              <Link href="/dashboard/settings#integrations" className="font-medium underline">
                Add them in Settings → Integrations
              </Link>{' '}
              to start sending review requests.
            </p>
          </div>
        )}
      </div>

      {/* How to Request Reviews */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">How to Request Reviews</h2>
        <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400 list-decimal list-inside">
          <li>Go to any customer&apos;s profile page</li>
          <li>Click <strong className="text-gray-900 dark:text-gray-100">Request Review</strong> in the top-right corner</li>
          <li>The customer receives an SMS with a link to your Google or Yelp page</li>
        </ol>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          The button is only visible for customers with a phone number and SMS consent who haven&apos;t opted out.
        </p>
      </div>

      {/* Recent Requests */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Review Requests</h2>
        {isLoading ? (
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
                    <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">{log.toPhone}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.status === 'sent' || log.status === 'delivered'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
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
