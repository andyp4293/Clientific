'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { MapPin, Phone, Mail, Clock, Globe, ArrowLeft } from 'lucide-react';

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
  phone: string;
  businessEmail: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  logoUrl: string | null;
  timezone: string;
  businessHours: { hours: Record<string, DayHours> } | null;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function BusinessInfoPage() {
  const params = useParams();
  const slugOrPublicId = params.slug as string;

  // Determine if this is a publicId (format: XX-XXXXXX) or a slug
  const isPublicId = /^[A-Z]{2}-[A-Z0-9]{6}$/.test(slugOrPublicId);
  const apiBase = isPublicId
    ? `/api/public/business-by-id/${slugOrPublicId}`
    : `/api/public/business/${slugOrPublicId}`;

  // Fetch business info — append infoOnly=true to bypass the enableOnlineBooking gate
  const { data: businessData, isLoading } = useQuery({
    queryKey: ['business-info', slugOrPublicId],
    queryFn: async () => {
      const res = await fetch(`${apiBase}?infoOnly=true`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const business: Business | null = businessData?.business;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading business information...</p>
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Business Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400">The business you&apos;re looking for doesn&apos;t exist.</p>
        </div>
      </div>
    );
  }

  const hasAddress = business.street && business.city && business.state;
  const hoursData: Record<string, DayHours> = (business.businessHours?.hours as Record<string, DayHours>) || {};

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <Link
            href={`/book/${slugOrPublicId}`}
            className="inline-flex items-center gap-2 text-primary dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300 font-medium mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Booking
          </Link>

          <div className="flex items-start gap-6">
            {business.logoUrl && (
              <img
                src={business.logoUrl}
                alt={business.name}
                className="w-20 h-20 rounded-xl object-cover border border-gray-200 dark:border-gray-700"
              />
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">{business.name}</h1>
              <p className="text-gray-600 dark:text-gray-400 capitalize">{business.businessType.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Information */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Contact Information</h2>
              <div className="space-y-4">
                {business.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-primary dark:text-primary-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone</p>
                      <a
                        href={`tel:${business.phone}`}
                        className="text-gray-900 dark:text-gray-100 hover:text-primary dark:hover:text-primary-400"
                      >
                        {business.phone}
                      </a>
                    </div>
                  </div>
                )}

                {business.businessEmail && (
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-primary dark:text-primary-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</p>
                      <a
                        href={`mailto:${business.businessEmail}`}
                        className="text-gray-900 dark:text-gray-100 hover:text-primary dark:hover:text-primary-400"
                      >
                        {business.businessEmail}
                      </a>
                    </div>
                  </div>
                )}

                {hasAddress && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-primary dark:text-primary-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Address</p>
                      <address className="text-gray-900 dark:text-gray-100 not-italic">
                        {business.street}<br />
                        {business.city}, {business.state} {business.zipCode}
                      </address>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${business.street}, ${business.city}, ${business.state} ${business.zipCode}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300 font-medium mt-1 inline-block"
                      >
                        Get Directions →
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Globe className="w-5 h-5 text-primary dark:text-primary-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Timezone</p>
                    <p className="text-gray-900 dark:text-gray-100">{business.timezone}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Business Hours */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Business Hours
              </h2>
              <div className="space-y-3">
                {DAYS.map((day, index) => {
                  const hours = hoursData[index.toString()];
                  const isToday = new Date().getDay() === index;

                  return (
                    <div
                      key={day}
                      className={`flex justify-between items-center py-2 px-3 rounded-lg ${
                        isToday ? 'bg-primary-50 dark:bg-primary/10 border border-primary-200 dark:border-primary-800' : ''
                      }`}
                    >
                      <span className={`font-medium ${isToday ? 'text-primary-900 dark:text-primary-300' : 'text-gray-900 dark:text-gray-100'}`}>
                        {day}
                        {isToday && <span className="ml-2 text-xs text-primary dark:text-primary-400">(Today)</span>}
                      </span>
                      {hours?.isOpen ? (
                        <span className={isToday ? 'text-primary-900 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}>
                          {formatTime(hours.openTime!)} – {formatTime(hours.closeTime!)}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">Closed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Policies */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Booking Policies</h2>
              <div className="space-y-4 text-gray-700 dark:text-gray-300">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Cancellation Policy</h3>
                  <p className="text-sm">
                    Please cancel or reschedule at least 24 hours in advance. Late cancellations
                    may result in a fee.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Late Arrivals</h3>
                  <p className="text-sm">
                    Please arrive 5–10 minutes before your scheduled appointment. If you arrive
                    more than 15 minutes late, we may need to reschedule your appointment.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">SMS Notifications</h3>
                  <p className="text-sm">
                    SMS appointment reminders are optional. During booking you can check the box to
                    opt in to receiving SMS updates. Message and data rates may apply. Reply STOP at
                    any time to opt out.
                  </p>
                  <div className="mt-2">
                    <a href="/terms" target="_blank" className="text-sm text-primary dark:text-primary-400 hover:underline mr-4">
                      Terms of Service
                    </a>
                    <a href="/privacy" target="_blank" className="text-sm text-primary dark:text-primary-400 hover:underline">
                      Privacy Policy
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Book Now CTA */}
            <div className="bg-primary text-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-bold mb-3">Ready to Book?</h3>
              <p className="text-primary-100 text-sm mb-4">
                Schedule your appointment online in just a few clicks.
              </p>
              <Link
                href={`/book/${slugOrPublicId}`}
                className="block w-full py-3 bg-white text-primary rounded-xl font-semibold text-center hover:bg-primary-50 transition-colors"
              >
                Book Appointment
              </Link>
            </div>

            {/* Quick Facts */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Quick Facts</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Business Type</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                    {business.businessType.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Online Booking</span>
                  <span className="font-medium text-green-600 dark:text-green-400">✓ Available</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">SMS Reminders</span>
                  <span className="font-medium text-green-600 dark:text-green-400">✓ Optional</span>
                </div>
              </div>
            </div>

            {/* Help */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">Need Help?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Have questions about booking or our services? Get in touch!
              </p>
              <div className="space-y-2">
                {business.phone && (
                  <a
                    href={`tel:${business.phone}`}
                    className="block w-full py-2 px-4 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 text-center transition-colors"
                  >
                    Call Us
                  </a>
                )}
                {business.businessEmail && (
                  <a
                    href={`mailto:${business.businessEmail}`}
                    className="block w-full py-2 px-4 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 text-center transition-colors"
                  >
                    Email Us
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}
