'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DatePicker } from '@/components/ui/DatePicker';
import Link from 'next/link';
import { Info } from 'lucide-react';
import { APP_NAME } from '@/lib/brand';

interface Business {
  id: string;
  name: string;
  slug: string;
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
    dayOfWeek: number;
    isOpen: boolean;
    openTime: string | null;
    closeTime: string | null;
  }>;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number | null;
}

interface Staff {
  id: string;
  fullName: string;
}

interface Deal {
  id: string;
  title: string;
  discountType: string;
  discountValue: number;
  expiresAt: string;
  service: { name: string } | null;
}

export default function PublicBookingPage() {
  const params = useParams();
  const router = useRouter();
  const slugOrPublicId = params.slug as string;
  const [step, setStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  // Initialize with today's date in local timezone
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    email: '',
    notes: '',
    smsConsent: false,
  });
  const [claimedCodes, setClaimedCodes] = useState<Record<string, string>>({});
  const [claimingDealId, setClaimingDealId] = useState<string | null>(null);

  // Derived totals
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + (s.price ?? 0), 0);
  const hasPrices = selectedServices.some(s => s.price != null && s.price > 0);

  // Determine if this is a publicId (format: XX-XXXXXX) or a slug
  const isPublicId = /^[A-Z]{2}-[A-Z0-9]{6}$/.test(slugOrPublicId);
  const apiBase = isPublicId
    ? `/api/public/business-by-id/${slugOrPublicId}`
    : `/api/public/business/${slugOrPublicId}`;

  // Fetch business info
  const { data: businessData, isLoading: isLoadingBusiness } = useQuery({
    queryKey: ['business', slugOrPublicId],
    queryFn: async () => {
      const res = await fetch(apiBase);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch business');
      }
      return res.json();
    },
  });

  // Fetch services
  const { data: servicesData } = useQuery({
    queryKey: ['services', slugOrPublicId],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/services`);
      if (!res.ok) throw new Error('Failed to fetch services');
      return res.json();
    },
    enabled: !!businessData,
  });

  // Fetch active deals
  const { data: dealsData } = useQuery({
    queryKey: ['public-deals', slugOrPublicId],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/deals`);
      if (!res.ok) throw new Error('Failed to fetch deals');
      return res.json();
    },
    enabled: !!businessData,
  });

  // Fetch staff
  const { data: staffData } = useQuery({
    queryKey: ['staff', slugOrPublicId],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/staff`);
      if (!res.ok) throw new Error('Failed to fetch staff');
      return res.json();
    },
    enabled: !!businessData,
  });

  // Format date as YYYY-MM-DD using local date parts (avoids UTC offset shifting the date)
  const formatDateLocal = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Fetch available slots — use first service's id + combined duration
  const { data: slotsData, isLoading: isLoadingSlots } = useQuery({
    queryKey: ['slots', slugOrPublicId, formatDateLocal(selectedDate), selectedServices.map(s => s.id).join(','), selectedStaff],
    queryFn: async () => {
      if (!selectedServices.length) return { slots: [] };
      const qp = new URLSearchParams({
        date: formatDateLocal(selectedDate),
        serviceId: selectedServices[0].id,
        duration: String(totalDuration),
        ...(selectedStaff && selectedStaff !== 'anyone' && { staffId: selectedStaff }),
      });
      const res = await fetch(`${apiBase}/available-slots?${qp}`);
      if (!res.ok) throw new Error('Failed to fetch slots');
      return res.json();
    },
    enabled: !!selectedServices.length && step === 3,
  });

  // Create booking mutation
  const bookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      const res = await fetch(`${apiBase}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create booking');
      }
      return res.json();
    },
    onSuccess: (data) => {
      router.push(`/appt/${data.appointment.id}`);
    },
  });

  const claimDeal = async (dealId: string) => {
    setClaimingDealId(dealId);
    try {
      const res = await fetch(`/api/public/deals/${dealId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerPhone: customerInfo.phone || undefined }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setClaimedCodes(prev => ({ ...prev, [dealId]: data.code }));
    } catch {
      // silently fail — deal may have run out
    } finally {
      setClaimingDealId(null);
    }
  };

  const business: Business | null = businessData?.business;
  const services: Service[] = servicesData?.services || [];
  const staff: Staff[] = staffData?.staff || [];
  const deals: Deal[] = dealsData?.deals || [];
  const availableSlots: string[] = slotsData?.slots || [];
  const unavailableSlots: string[] = slotsData?.unavailableSlots || [];
  // All slots sorted by time for display
  const allSlots = [...availableSlots, ...unavailableSlots].sort();
  const unavailableSet = new Set(unavailableSlots);

  const toggleService = (service: Service) => {
    setSelectedServices(prev =>
      prev.some(s => s.id === service.id)
        ? prev.filter(s => s.id !== service.id)
        : [...prev, service]
    );
  };

  const handleBooking = () => {
    if (!selectedServices.length || !selectedTime) return;

    bookingMutation.mutate({
      serviceIds: selectedServices.map(s => s.id),
      serviceId: selectedServices[0].id,
      staffId: selectedStaff ?? 'anyone',
      startTime: selectedTime,
      duration: totalDuration,
      customerName: customerInfo.name,
      customerPhone: customerInfo.phone,
      customerEmail: customerInfo.email || undefined,
      notes: customerInfo.notes || undefined,
      smsConsent: customerInfo.smsConsent,
    });
  };

  if (isLoadingBusiness) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading booking page...</p>
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Business Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400">The booking page you&apos;re looking for doesn&apos;t exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              {business.logoUrl && (
                <img src={business.logoUrl} alt={business.name} className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover flex-shrink-0" />
              )}
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">{business.name}</h1>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Book an appointment</p>
              </div>
            </div>
            <Link
              href={`/book/${slugOrPublicId}/info`}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex-shrink-0"
              title="View business information"
            >
              <Info className="w-4 h-4" />
              <span className="hidden sm:inline">Info</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center">
            {[
              { num: 1, label: 'Services' },
              { num: 2, label: 'Staff' },
              { num: 3, label: 'Date & Time' },
              { num: 4, label: 'Your Info' },
            ].map((item, idx) => (
              <React.Fragment key={item.num}>
                {/* Connector line between steps */}
                {idx > 0 && (
                  <div className={`flex-1 h-0.5 sm:h-1 mx-1 sm:mx-2 ${
                    step > item.num - 1 ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`} />
                )}
                {/* Step circle + label */}
                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium flex-shrink-0 ${
                      step >= item.num
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {item.num}
                  </div>
                  <span className={`text-xs sm:text-sm font-medium hidden md:inline whitespace-nowrap ${
                    step >= item.num ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {item.label}
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Current Deals Banner */}
        {deals.length > 0 && (
          <div className="mb-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-amber-200 dark:border-amber-700 p-4">
            <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-3">Current Deals</h3>
            <div className="space-y-3">
              {deals.map(deal => (
                <div key={deal.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{deal.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {deal.service?.name ?? 'Any service'} · Expires {new Date(deal.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  {claimedCodes[deal.id] ? (
                    <span className="text-xs font-mono bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-2 py-1 rounded font-bold flex-shrink-0">
                      {claimedCodes[deal.id]}
                    </span>
                  ) : (
                    <button
                      onClick={() => claimDeal(deal.id)}
                      disabled={claimingDealId === deal.id}
                      className="text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {claimingDealId === deal.id ? '...' : 'Claim'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm p-4 sm:p-6">

          {/* Step 1: Select Services (multi-select) */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">Select Services</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Choose one or more services for your appointment.</p>

              <div className="space-y-3">
                {services.map((service) => {
                  const isSelected = selectedServices.some(s => s.id === service.id);
                  return (
                    <button
                      key={service.id}
                      onClick={() => toggleService(service)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox indicator */}
                        <div className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center ${
                          isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-400 dark:border-gray-500'
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className={`font-semibold mb-0.5 ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                {service.name}
                              </h3>
                              {service.description && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{service.description}</p>
                              )}
                              <p className="text-sm text-gray-500 dark:text-gray-400">{service.duration} min</p>
                            </div>
                            {service.price != null && service.price > 0 && (
                              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 ml-4 flex-shrink-0">
                                ${service.price.toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selection summary + Continue */}
              <div className="mt-6">
                {selectedServices.length > 0 && (
                  <div className="mb-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-sm text-blue-800 dark:text-blue-300 flex justify-between items-center">
                    <span>
                      {selectedServices.length} service{selectedServices.length > 1 ? 's' : ''} selected
                      {' · '}{totalDuration} min
                    </span>
                    {hasPrices && (
                      <span className="font-bold">${totalPrice.toFixed(2)}</span>
                    )}
                  </div>
                )}
                <button
                  onClick={() => setStep(2)}
                  disabled={selectedServices.length === 0}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Select Staff */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Choose Staff Member</h2>
              <div className="space-y-3">
                <button
                  onClick={() => setSelectedStaff('anyone')}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    selectedStaff === 'anyone'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10'
                  }`}
                >
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Anyone Available</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">First available staff member</p>
                </button>

                {staff.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedStaff(member.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      selectedStaff === member.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10'
                    }`}
                  >
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{member.fullName}</h3>
                  </button>
                ))}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!selectedStaff}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Select Date & Time */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Choose Date & Time</h2>

              {/* Date Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Date</label>
                <DatePicker
                  value={selectedDate}
                  onChange={(newDate) => {
                    setSelectedDate(newDate);
                    setSelectedTime(null);
                  }}
                  minDate={new Date()}
                />
              </div>

              {/* Time Slots */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Available Times</label>
                {isLoadingSlots ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : allSlots.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600 dark:text-gray-400">No available times for this date. Please select another date.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-96 overflow-y-auto">
                    {allSlots.map((slot) => {
                      const slotDate = new Date(slot);
                      const timeStr = slotDate.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZone: business.timezone,
                      });
                      const isBooked = unavailableSet.has(slot);

                      if (isBooked) {
                        return (
                          <div
                            key={slot}
                            className="p-3 rounded-lg text-sm font-medium text-center bg-gray-100 dark:bg-gray-700/50 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                          >
                            {timeStr}
                          </div>
                        );
                      }

                      return (
                        <button
                          key={slot}
                          onClick={() => setSelectedTime(slot)}
                          className={`p-3 rounded-lg text-sm font-medium transition-all ${
                            selectedTime === slot
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {timeStr}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setSelectedStaff(null); setStep(2); }}
                  className="flex-1 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  disabled={!selectedTime}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Customer Info */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Your Information</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerInfo.name}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={customerInfo.phone}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={customerInfo.email}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    value={customerInfo.notes}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="Any special requests or notes..."
                  />
                </div>

                {/* SMS Consent Checkbox */}
                <button
                  type="button"
                  onClick={() => setCustomerInfo({ ...customerInfo, smsConsent: !customerInfo.smsConsent })}
                  className="w-full text-left bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center ${
                      customerInfo.smsConsent ? 'bg-blue-600 border-blue-600' : 'bg-white dark:bg-gray-700 border-gray-400 dark:border-gray-500'
                    }`}>
                      {customerInfo.smsConsent && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                      <span className="font-medium">Yes, send me SMS appointment reminders and updates.</span> Message and data rates may apply. Message frequency varies. Reply STOP to cancel, HELP for help. This is optional — you can still book without SMS.
                    </span>
                  </div>
                </button>
              </div>

              {bookingMutation.isError && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <p className="text-sm text-red-800 dark:text-red-300">
                    {bookingMutation.error instanceof Error
                      ? bookingMutation.error.message
                      : 'Failed to create booking'}
                  </p>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(3)}
                  disabled={bookingMutation.isPending}
                  className="flex-1 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  ← Back
                </button>
                <button
                  onClick={handleBooking}
                  disabled={
                    !customerInfo.name ||
                    !customerInfo.phone ||
                    bookingMutation.isPending
                  }
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bookingMutation.isPending ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Booking Summary */}
        {selectedServices.length > 0 && step > 1 && step < 5 && (
          <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Booking Summary</h3>
            <div className="space-y-3 text-sm">
              {selectedServices.length === 1 ? (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Service:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{selectedServices[0].name}</span>
                </div>
              ) : (
                <div>
                  <span className="text-gray-600 dark:text-gray-400 block mb-1">Services:</span>
                  <ul className="space-y-1">
                    {selectedServices.map(s => (
                      <li key={s.id} className="flex justify-between">
                        <span className="font-medium text-gray-900 dark:text-gray-100 ml-2">{s.name}</span>
                        {s.price != null && s.price > 0 && (
                          <span className="text-gray-600 dark:text-gray-400">${s.price.toFixed(2)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {step >= 3 && selectedStaff && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Staff:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {selectedStaff === 'anyone'
                      ? 'Anyone Available'
                      : staff.find(s => s.id === selectedStaff)?.fullName}
                  </span>
                </div>
              )}

              {step >= 3 && selectedTime && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Date:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {new Date(selectedTime).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Time:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {new Date(selectedTime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZone: business.timezone,
                      })}
                    </span>
                  </div>
                </>
              )}

              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{totalDuration} min</span>
              </div>

              {hasPrices && (
                <div className="flex justify-between pt-3 border-t border-blue-200 dark:border-blue-800">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">Total:</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100">${totalPrice.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer with Terms & Privacy */}
      {business && (
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            By booking, I agree to {business.name}&apos;s cancellation policy and {APP_NAME}&apos;s{' '}
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              terms and conditions
            </Link>
            {' '}/{' '}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              privacy policy
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
