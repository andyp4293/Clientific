'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { APP_NAME } from '@/lib/brand';

interface DealBusiness {
  name: string;
  businessType: string;
  city: string | null;
  slug: string;
  publicId: string | null;
}

interface ExploreDeal {
  id: string;
  title: string;
  discountType: string;
  discountValue: number;
  expiresAt: string;
  business: DealBusiness;
}

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'nails', label: 'Nails' },
  { value: 'hair', label: 'Hair' },
  { value: 'barber', label: 'Barber' },
  { value: 'spa', label: 'Spa' },
  { value: 'massage', label: 'Massage' },
];

function discountLabel(type: string, value: number): string {
  if (type === 'percent_off') return `${value}% off`;
  if (type === 'amount_off') return `$${value.toFixed(2)} off`;
  return 'Free service';
}

function expiresLabel(iso: string): { text: string; urgent: boolean } {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (days <= 7) return { text: `Expires in ${days} day${days !== 1 ? 's' : ''}`, urgent: true };
  return {
    text: `Until ${new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    urgent: false,
  };
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm animate-pulse">
      <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
      <div className="h-8 bg-gray-100 rounded w-1/3 mb-3" />
      <div className="h-9 bg-gray-100 rounded w-full" />
    </div>
  );
}

export default function ExplorePage() {
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('all');
  const [deals, setDeals] = useState<ExploreDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searched, setSearched] = useState(false);

  const fetchDeals = async (cityVal: string, catVal: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cityVal) params.set('city', cityVal);
      if (catVal && catVal !== 'all') params.set('category', catVal);
      const res = await fetch(`/api/public/explore/deals?${params.toString()}`);
      const data = await res.json();
      setDeals(data.deals || []);
    } catch {
      setDeals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals('', 'all');
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearched(true);
    fetchDeals(city, category);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-gray-900">
            {APP_NAME}
          </Link>
          <Link
            href="/register"
            className="text-sm font-semibold text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
          >
            List Your Business
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Deals Near You</h1>
          <p className="text-gray-500 text-lg">
            Save on nail, hair, spa, and barber services at businesses in your area.
          </p>
        </div>

        {/* Filter bar */}
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-8">
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="City or zip code"
            value={city}
            onChange={e => setCity(e.target.value)}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors whitespace-nowrap"
          >
            Find Deals
          </button>
        </form>

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : deals.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">
              {searched ? 'No active deals found. Try a different city or category.' : 'No active deals right now. Check back soon.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {deals.map(deal => {
              const expires = expiresLabel(deal.expiresAt);
              return (
                <div
                  key={deal.id}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-gray-900 text-sm leading-snug">{deal.business.name}</p>
                    <span className="shrink-0 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium capitalize">
                      {deal.business.businessType}
                    </span>
                  </div>

                  {deal.business.city && (
                    <p className="text-xs text-gray-400 mb-2">{deal.business.city}</p>
                  )}

                  <p className="text-sm text-gray-700 mb-3 flex-1">{deal.title}</p>

                  <div className="flex items-center justify-between mb-3">
                    <span className="bg-amber-100 text-amber-800 text-sm font-bold px-2 py-0.5 rounded">
                      {discountLabel(deal.discountType, deal.discountValue)}
                    </span>
                    <span className={`text-xs font-medium ${expires.urgent ? 'text-red-600' : 'text-gray-400'}`}>
                      {expires.text}
                    </span>
                  </div>

                  <a
                    href={`/d/${deal.id}`}
                    className="block w-full text-center text-sm font-semibold text-primary border border-primary/40 px-3 py-2 rounded-lg hover:bg-primary/5 transition-colors"
                  >
                    Claim Deal
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="text-center py-8 text-xs text-gray-400">
        Powered by {APP_NAME}
      </footer>
    </div>
  );
}
