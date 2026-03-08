import { notFound } from 'next/navigation';
import Link from 'next/link';
import { APP_NAME, APP_URL } from '@/lib/brand';

export const revalidate = 60;

interface Business {
  id: string;
  name: string;
  slug: string;
  businessType: string;
  phone: string | null;
  city: string | null;
  state: string | null;
}

interface Deal {
  id: string;
  title: string;
  discountType: string;
  discountValue: number;
  expiresAt: string;
}

interface Service {
  id: string;
  name: string;
  duration: number;
  price: number | null;
}

function discountLabel(type: string, value: number): string {
  if (type === 'percent_off') return `${value}% off`;
  if (type === 'amount_off') return `$${value.toFixed(2)} off`;
  return 'Free service';
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const res = await fetch(`${APP_URL}/api/public/business/${params.slug}?infoOnly=true`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return { title: APP_NAME };
  const { business } = await res.json();
  return {
    title: `${business.name} — Deals & Booking | ${APP_NAME}`,
    description: `Book appointments and claim deals at ${business.name}${business.city ? ` in ${business.city}` : ''}.`,
  };
}

export default async function BusinessProfilePage({ params }: { params: { slug: string } }) {
  const [bizRes, dealsRes, servicesRes] = await Promise.all([
    fetch(`${APP_URL}/api/public/business/${params.slug}?infoOnly=true`, { next: { revalidate: 60 } }),
    fetch(`${APP_URL}/api/public/business/${params.slug}/deals`, { next: { revalidate: 60 } }),
    fetch(`${APP_URL}/api/public/business/${params.slug}/services`, { next: { revalidate: 60 } }),
  ]);

  if (!bizRes.ok) notFound();

  const { business }: { business: Business } = await bizRes.json();
  const dealsData = dealsRes.ok ? await dealsRes.json() : { deals: [] };
  const servicesData = servicesRes.ok ? await servicesRes.json() : { services: [] };

  const deals: Deal[] = dealsData.deals ?? [];
  const services: Service[] = servicesData.services ?? [];

  const activeDeals = deals.filter(d => new Date(d.expiresAt) > new Date());

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-gray-900 dark:text-white">
            {APP_NAME}
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Business hero */}
        <div>
          <div className="flex items-start gap-3 flex-wrap mb-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{business.name}</h1>
            <span className="mt-1 bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-full capitalize">
              {business.businessType}
            </span>
          </div>
          {(business.city || business.state) && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {[business.city, business.state].filter(Boolean).join(', ')}
            </p>
          )}
          {business.phone && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{business.phone}</p>
          )}

          <a
            href={`/book/${business.slug}`}
            className="inline-block w-full sm:w-auto text-center bg-primary text-white font-semibold px-6 py-3 rounded-xl hover:bg-primary-700 transition-colors text-sm"
          >
            Book an Appointment
          </a>
        </div>

        {/* Active deals */}
        {activeDeals.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Current Deals</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeDeals.map(deal => (
                <div
                  key={deal.id}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm"
                >
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{deal.title}</p>
                  <div className="flex items-center justify-between mb-3">
                    <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-sm font-bold px-2 py-0.5 rounded">
                      {discountLabel(deal.discountType, deal.discountValue)}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      Until {new Date(deal.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <a
                    href={`/d/${deal.id}`}
                    className="block w-full text-center text-sm font-semibold text-primary border border-primary/40 px-3 py-2 rounded-lg hover:bg-primary/5 transition-colors"
                  >
                    Claim Deal
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Services */}
        {services.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Services</h2>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
              {services.map(service => (
                <div key={service.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{service.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{service.duration} min</p>
                  </div>
                  {service.price !== null && (
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      ${service.price.toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="text-center py-8 text-xs text-gray-400 dark:text-gray-600">
        Powered by {APP_NAME}
      </footer>
    </div>
  );
}
