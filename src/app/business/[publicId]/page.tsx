'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import {
  Clock3,
  ExternalLink,
  MapPin,
  Sparkles,
  Users,
} from 'lucide-react';
import { groupServicesForDisplay } from '@/lib/service-grouping';
import { getPublicProfileVisibility } from '@/lib/public-profile-visibility';

interface DayHours {
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
}

interface Business {
  id: string;
  name: string;
  slug: string;
  publicId: string;
  businessType: string;
  street: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  logoUrl: string | null;
  timezone: string;
  enableOnlineBooking: boolean;
  businessHours: { hours: Record<string, DayHours> } | null;
  publicProfileHeadline: string | null;
  publicProfileAbout: string | null;
  publicProfileShowAddress: boolean;
  publicProfileShowHours: boolean;
  publicProfileShowServices: boolean;
  publicProfileShowTeam: boolean;
  publicProfileShowSocialLinks: boolean;
  googleReviewUrl: string | null;
  facebookPageUrl: string | null;
  yelpUrl: string | null;
  instagramUrl: string | null;
}

interface PublicService {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number | null;
  groupId: string | null;
  sortOrder: number;
}

interface ServiceGroup {
  id: string;
  name: string;
  sortOrder: number;
}

interface StaffMember {
  id: string;
  fullName: string;
  role: string | null;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function BusinessInfoPage() {
  const params = useParams();
  const publicId = params.publicId as string;
  const { data: session } = useSession();
  const apiBase = `/api/public/business-by-id/${publicId}`;

  const { data: businessData, isLoading } = useQuery({
    queryKey: ['business-profile', publicId],
    queryFn: async () => {
      const res = await fetch(`${apiBase}?infoOnly=true`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const business: Business | null = businessData?.business ?? null;

  const shouldFetchServices = Boolean(business && business.publicProfileShowServices);
  const shouldFetchTeam = Boolean(business && business.publicProfileShowTeam);

  const { data: servicesData } = useQuery({
    queryKey: ['business-profile-services', publicId],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/services?infoOnly=true`);
      if (!res.ok) return { services: [], groups: [] };
      return res.json();
    },
    enabled: shouldFetchServices,
  });

  const { data: staffData } = useQuery({
    queryKey: ['business-profile-staff', publicId],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/staff?infoOnly=true`);
      if (!res.ok) return { staff: [] };
      return res.json();
    },
    enabled: shouldFetchTeam,
  });

  const services: PublicService[] = servicesData?.services ?? [];
  const groups: ServiceGroup[] = servicesData?.groups ?? [];
  const staff: StaffMember[] = staffData?.staff ?? [];

  const groupedServices = useMemo(
    () => groupServicesForDisplay(services, groups),
    [services, groups]
  );

  if (isLoading) {
    return (
      <div className="page-shell min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading business profile...</p>
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="page-shell min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Business Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400">The business profile you requested is unavailable.</p>
        </div>
      </div>
    );
  }

  const hoursData: Record<string, DayHours> = business.businessHours?.hours ?? {};
  const visibility = getPublicProfileVisibility({
    publicProfileShowAddress: business.publicProfileShowAddress,
    publicProfileShowHours: business.publicProfileShowHours,
    publicProfileShowServices: business.publicProfileShowServices,
    publicProfileShowTeam: business.publicProfileShowTeam,
    publicProfileShowSocialLinks: business.publicProfileShowSocialLinks,
    street: business.street,
    city: business.city,
    state: business.state,
  });
  const socialLinks = [
    { label: 'Google Reviews', href: business.googleReviewUrl },
    { label: 'Facebook', href: business.facebookPageUrl },
    { label: 'Yelp', href: business.yelpUrl },
    { label: 'Instagram', href: business.instagramUrl },
  ].filter((item) => item.href);

  return (
    <div className="page-shell min-h-screen">
      {session && (
        <div className="bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 px-4 py-2">
          <div className="max-w-6xl mx-auto">
            <Link href="/dashboard/preview" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
              <span aria-hidden="true">&larr;</span> Back to preview
            </Link>
          </div>
        </div>
      )}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-gradient-to-br from-gray-900 via-gray-800 to-primary-900">
        <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14">
          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            {business.logoUrl ? (
              <img
                src={business.logoUrl}
                alt={business.name}
                className="w-20 h-20 rounded-2xl object-cover border border-white/20 shadow-lg"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary-200" />
              </div>
            )}

            <div className="flex-1">
              <p className="text-sm uppercase tracking-[0.2em] text-primary-200/90 mb-2">
                {formatBusinessType(business.businessType)}
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold text-white">{business.name}</h1>
              {business.publicProfileHeadline && (
                <p className="text-base sm:text-lg text-gray-100/90 mt-3 max-w-2xl">
                  {business.publicProfileHeadline}
                </p>
              )}
            </div>

            {business.enableOnlineBooking && (
              <Link
                href={`/book/${business.publicId}`}
                className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-white text-gray-900 font-semibold hover:bg-primary-50 transition-colors"
              >
                Book Appointment
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10 grid lg:grid-cols-3 gap-6">
        <main className="lg:col-span-2 space-y-6">
          {business.publicProfileAbout && (
            <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">About</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {business.publicProfileAbout}
              </p>
            </section>
          )}

          {visibility.showServices && (
            <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Services</h2>

              {!services.length ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No services published yet.</p>
              ) : groupedServices.hasGroups ? (
                <div className="space-y-5">
                  {groupedServices.groupedSections.map((section) => (
                    section.services.length > 0 ? (
                      <div key={section.group.id}>
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                          {section.group.name}
                        </h3>
                        <ServiceList services={section.services} />
                      </div>
                    ) : null
                  ))}

                  {groupedServices.ungroupedServices.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                        Other Services
                      </h3>
                      <ServiceList services={groupedServices.ungroupedServices} />
                    </div>
                  )}
                </div>
              ) : (
                <ServiceList services={groupedServices.flatServices} />
              )}
            </section>
          )}

          {visibility.showHours && (
            <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Clock3 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                Business Hours
              </h2>
              <div className="space-y-2">
                {DAYS.map((day, index) => {
                  const dayHours = hoursData[index.toString()];
                  const isToday = new Date().getDay() === index;

                  return (
                    <div
                      key={day}
                      className={`flex justify-between items-center px-3 py-2 rounded-lg ${
                        isToday
                          ? 'bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-900'
                          : 'bg-gray-50 dark:bg-gray-800/60'
                      }`}
                    >
                      <span className={`font-medium ${isToday ? 'text-primary-900 dark:text-primary-300' : 'text-gray-800 dark:text-gray-200'}`}>
                        {day}
                        {isToday && <span className="ml-2 text-xs">(Today)</span>}
                      </span>
                      {dayHours?.isOpen && dayHours.openTime && dayHours.closeTime ? (
                        <span className={isToday ? 'text-primary-800 dark:text-primary-300' : 'text-gray-600 dark:text-gray-300'}>
                          {formatTime(dayHours.openTime)} - {formatTime(dayHours.closeTime)}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">Closed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {visibility.showTeam && staff.length > 0 && (
            <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                Team
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {staff.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-4 py-3"
                  >
                    <p className="font-medium text-gray-900 dark:text-gray-100">{member.fullName}</p>
                    {member.role && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">{member.role}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>

        <aside className="space-y-4 lg:sticky lg:top-4 h-fit">
          <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Location</h2>
            <div className="space-y-4">
              {visibility.showAddress && (
                <div className="space-y-1">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 mt-1 text-primary-600 dark:text-primary-400" />
                    <address className="not-italic text-gray-700 dark:text-gray-300 text-sm">
                      {business.street}<br />
                      {business.city}, {business.state} {business.zipCode}
                    </address>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${business.street}, ${business.city}, ${business.state} ${business.zipCode}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 dark:text-primary-300 hover:underline ml-7"
                  >
                    Get Directions
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          </section>

          {visibility.showSocialLinks && socialLinks.length > 0 && (
            <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Find Us Online</h2>
              <div className="space-y-2">
                {socialLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    {link.label}
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                  </a>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function ServiceList({ services }: { services: PublicService[] }) {
  return (
    <ul className="space-y-2">
      {services.map((service) => (
        <li
          key={service.id}
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-4 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-gray-100">{service.name}</p>
              {service.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{service.description}</p>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{service.duration} min</p>
            </div>
            {service.price != null && service.price > 0 && (
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                ${service.price.toFixed(2)}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function formatBusinessType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


