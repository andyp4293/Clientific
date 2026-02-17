'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { MapPin, Phone, Mail, Clock, Globe, ArrowLeft } from 'lucide-react';

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
  businessHours: Array<{
    id: string;
    hours: Record<string, {
      isOpen: boolean;
      openTime: string | null;
      closeTime: string | null;
    }>;
  }>;
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

  // Fetch business info
  const { data: businessData, isLoading } = useQuery({
    queryKey: ['business-info', slugOrPublicId],
    queryFn: async () => {
      const res = await fetch(apiBase);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch business');
      }
      return res.json();
    },
  });

  const business: Business | null = businessData?.business;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading business information...</p>
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Business Not Found</h1>
          <p className="text-gray-600">The business you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const businessHoursData = business.businessHours?.[0]?.hours || {};
  const hasAddress = business.street && business.city && business.state;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <Link 
            href={`/book/${slugOrPublicId}`}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Booking
          </Link>
          
          <div className="flex items-start gap-6">
            {business.logoUrl && (
              <img 
                src={business.logoUrl} 
                alt={business.name}
                className="w-20 h-20 rounded-xl object-cover border border-gray-200"
              />
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{business.name}</h1>
              <p className="text-gray-600 capitalize">{business.businessType.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Information */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Contact Information</h2>
              <div className="space-y-4">
                {business.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Phone</p>
                      <a 
                        href={`tel:${business.phone}`}
                        className="text-gray-900 hover:text-blue-600"
                      >
                        {business.phone}
                      </a>
                    </div>
                  </div>
                )}

                {business.businessEmail && (
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Email</p>
                      <a 
                        href={`mailto:${business.businessEmail}`}
                        className="text-gray-900 hover:text-blue-600"
                      >
                        {business.businessEmail}
                      </a>
                    </div>
                  </div>
                )}

                {hasAddress && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Address</p>
                      <address className="text-gray-900 not-italic">
                        {business.street}<br />
                        {business.city}, {business.state} {business.zipCode}
                      </address>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${business.street}, ${business.city}, ${business.state} ${business.zipCode}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-1 inline-block"
                      >
                        Get Directions →
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Globe className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Timezone</p>
                    <p className="text-gray-900">{business.timezone}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Business Hours */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Business Hours
              </h2>
              <div className="space-y-3">
                {DAYS.map((day, index) => {
                  const hours = businessHoursData[index.toString()];
                  const isToday = new Date().getDay() === index;
                  
                  return (
                    <div 
                      key={day}
                      className={`flex justify-between items-center py-2 px-3 rounded-lg ${
                        isToday ? 'bg-blue-50 border border-blue-200' : ''
                      }`}
                    >
                      <span className={`font-medium ${isToday ? 'text-blue-900' : 'text-gray-900'}`}>
                        {day}
                        {isToday && <span className="ml-2 text-xs text-blue-600">(Today)</span>}
                      </span>
                      {hours?.isOpen ? (
                        <span className={isToday ? 'text-blue-900' : 'text-gray-700'}>
                          {formatTime(hours.openTime!)} - {formatTime(hours.closeTime!)}
                        </span>
                      ) : (
                        <span className="text-gray-500">Closed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Policies */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Booking Policies</h2>
              <div className="space-y-4 text-gray-700">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Cancellation Policy</h3>
                  <p className="text-sm">
                    Please cancel or reschedule at least 24 hours in advance. Late cancellations 
                    may result in a fee or loss of loyalty points.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Late Arrivals</h3>
                  <p className="text-sm">
                    Please arrive 5-10 minutes before your scheduled appointment. If you arrive 
                    more than 15 minutes late, we may need to reschedule your appointment.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">SMS Notifications</h3>
                  <p className="text-sm">
                    By booking an appointment and providing your phone number, you consent to 
                    receive SMS notifications about your appointments. Message and data rates may apply. 
                    Reply STOP to opt-out.
                  </p>
                  <div className="mt-2">
                    <a href="/terms" target="_blank" className="text-sm text-blue-600 hover:text-blue-700 underline mr-4">
                      Terms of Service
                    </a>
                    <a href="/privacy" target="_blank" className="text-sm text-blue-600 hover:text-blue-700 underline">
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
            <div className="bg-blue-600 text-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-bold mb-3">Ready to Book?</h3>
              <p className="text-blue-100 text-sm mb-4">
                Schedule your appointment online in just a few clicks.
              </p>
              <Link
                href={`/book/${slugOrPublicId}`}
                className="block w-full py-3 bg-white text-blue-600 rounded-xl font-semibold text-center hover:bg-blue-50 transition-colors"
              >
                Book Appointment
              </Link>
            </div>

            {/* Quick Facts */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Facts</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Business Type</span>
                  <span className="font-medium text-gray-900 capitalize">
                    {business.businessType.replace('_', ' ')}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Online Booking</span>
                  <span className="font-medium text-green-600">✓ Available</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">SMS Reminders</span>
                  <span className="font-medium text-green-600">✓ Enabled</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Loyalty Program</span>
                  <span className="font-medium text-green-600">✓ Active</span>
                </div>
              </div>
            </div>

            {/* Help */}
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Need Help?</h3>
              <p className="text-sm text-gray-600 mb-4">
                Have questions about booking or our services? Get in touch!
              </p>
              <div className="space-y-2">
                {business.phone && (
                  <a
                    href={`tel:${business.phone}`}
                    className="block w-full py-2 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 text-center transition-colors"
                  >
                    Call Us
                  </a>
                )}
                {business.businessEmail && (
                  <a
                    href={`mailto:${business.businessEmail}`}
                    className="block w-full py-2 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 text-center transition-colors"
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
