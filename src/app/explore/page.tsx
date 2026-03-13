'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, MapPin, Search, Sparkles, Tag } from 'lucide-react';
import LocationAutocomplete from '@/components/ui/LocationAutocomplete';
import { PublicSiteHeader } from '@/components/layout/PublicSiteHeader';
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
  { value: 'all', label: 'All Services' },
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

function formatBusinessType(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function expiresLabel(iso: string): { text: string; urgent: boolean } {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (days <= 7) {
    return {
      text: `Ends in ${Math.max(1, days)} day${days !== 1 ? 's' : ''}`,
      urgent: true,
    };
  }

  return {
    text: `Until ${new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    urgent: false,
  };
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2 h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-800" />
      <div className="mb-5 h-3 w-1/3 rounded bg-gray-200 dark:bg-gray-800" />
      <div className="mb-4 h-4 w-full rounded bg-gray-200 dark:bg-gray-800" />
      <div className="h-10 w-full rounded-xl bg-gray-200 dark:bg-gray-800" />
    </div>
  );
}

export default function ExplorePage() {
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('all');
  const [deals, setDeals] = useState<ExploreDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const fetchDeals = async (locationValue: string, categoryValue: string) => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (locationValue.trim()) params.set('location', locationValue.trim());
      if (categoryValue && categoryValue !== 'all') params.set('category', categoryValue);

      const res = await fetch(`/api/public/explore/deals?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to load deals');
      }

      const data = await res.json();
      setDeals(Array.isArray(data.deals) ? data.deals : []);
    } catch {
      setDeals([]);
      setError('Unable to load deals right now. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals('', 'all');
  }, []);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setSearched(true);
    fetchDeals(location, category);
  };

  const uniqueBusinessCount = useMemo(
    () => new Set(deals.map((deal) => deal.business.slug || deal.business.name)).size,
    [deals]
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at top right, rgb(var(--color-primary-500) / 0.16), transparent 45%), radial-gradient(circle at top left, rgb(var(--color-gray-800) / 0.08), transparent 35%)',
        }}
      />

      <PublicSiteHeader active="explore" />

      <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        <section className="mb-8 overflow-hidden rounded-3xl border border-gray-200 bg-white/80 shadow-xl shadow-gray-200/60 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80 dark:shadow-black/30">
          <div className="relative p-6 sm:p-8 lg:p-10">
            <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-primary/15 blur-2xl dark:bg-primary/25" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-primary/12 blur-2xl dark:bg-primary/22" />

            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary dark:border-primary/30 dark:bg-primary/20 dark:text-primary-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  Curated local promotions
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-100">
                  Discover trusted deals near you
                </h1>
                <p className="mt-3 max-w-2xl text-base text-gray-600 sm:text-lg dark:text-gray-300">
                  Find limited-time offers from verified salons, spas, and barber shops. Search by city or ZIP and claim in seconds.
                </p>
              </div>

              <div className="grid min-w-[220px] gap-3 text-sm">
                <div className="rounded-2xl border border-gray-200 bg-white/90 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/90">
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Active deals</div>
                  <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{loading ? '--' : deals.length}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white/90 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/90">
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Businesses</div>
                  <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{loading ? '--' : uniqueBusinessCount}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <form
          onSubmit={handleSearch}
          className="mb-8 rounded-3xl border border-gray-200 bg-white p-5 shadow-lg shadow-gray-200/60 dark:border-gray-800 dark:bg-gray-900 dark:shadow-black/30 sm:p-6"
        >
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <Search className="h-4 w-4" />
            Search promotions
          </div>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((item) => {
              const active = category === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setCategory(item.value)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'border-primary bg-primary text-white shadow-sm'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <LocationAutocomplete
                value={location}
                onChange={setLocation}
                inputClassName="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
                className="w-full"
                placeholder="Search by city or ZIP"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              Find Deals
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Available Deals</h2>
            {!loading && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {deals.length} result{deals.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/60 dark:bg-amber-950/30">
              <p className="text-sm text-amber-700 dark:text-amber-200">{error}</p>
            </div>
          ) : deals.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-gray-800 dark:bg-gray-900">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
                <Building2 className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </div>
              <p className="text-base font-medium text-gray-900 dark:text-gray-100">No active deals found</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {searched
                  ? 'Try another city, ZIP, or category to expand your results.'
                  : 'There are no active deals right now. Check back soon.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {deals.map((deal) => {
                const expires = expiresLabel(deal.expiresAt);

                return (
                  <article
                    key={deal.id}
                    className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{deal.business.name}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{deal.business.city || 'Location available on claim'}</p>
                      </div>
                      <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary dark:border-primary/35 dark:bg-primary/20 dark:text-primary-200">
                        {formatBusinessType(deal.business.businessType)}
                      </span>
                    </div>

                    <p className="mt-4 flex-1 text-sm leading-relaxed text-gray-700 dark:text-gray-300">{deal.title}</p>

                    <div className="mt-5 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-700 dark:bg-primary/16 dark:text-primary-200">
                        <Tag className="h-3.5 w-3.5" />
                        {discountLabel(deal.discountType, deal.discountValue)}
                      </span>
                      <span className={`text-xs font-medium ${expires.urgent ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {expires.text}
                      </span>
                    </div>

                    <Link
                      href={`/d/${deal.id}`}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 transition-colors group-hover:border-primary group-hover:text-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:group-hover:border-primary dark:group-hover:text-primary-200"
                    >
                      View Deal
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <footer className="relative border-t border-gray-200 py-8 text-center text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        Powered by {APP_NAME}
      </footer>
    </div>
  );
}
