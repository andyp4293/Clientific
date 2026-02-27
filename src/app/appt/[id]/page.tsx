'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';

interface Appointment {
  id: string;
  status: string;
  startTime: string;
  duration: number;
  notes: string | null;
  services: { name: string; price: number | null }[];
  totalPrice: number;
  service: { name: string; price: number | null } | null;
  staff: { fullName: string } | null;
  business: {
    name: string;
    phone: string;
    timezone: string;
    slug: string;
    publicId: string;
  };
}

export default function AppointmentPage() {
  const params = useParams();
  const id = params.id as string;
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['appointment', id],
    queryFn: async () => {
      const res = await fetch(`/api/public/appointment/${id}`);
      if (!res.ok) throw new Error('Appointment not found');
      return res.json();
    },
    // Poll every 30s while pending so the page auto-updates when business confirms
    refetchInterval: (query) => {
      const status = query.state.data?.appointment?.status;
      return status === 'pending' ? 30_000 : false;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/public/appointment/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to cancel');
      }
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !data?.appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Appointment not found</h1>
          <p className="text-gray-600">This link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  const appt: Appointment = cancelMutation.isSuccess
    ? { ...data.appointment, status: 'cancelled' }
    : data.appointment;

  const isPending = appt.status === 'pending';
  const isCancelled = appt.status === 'cancelled';
  const isConfirmed = appt.status === 'confirmed';

  const start = new Date(appt.startTime);

  const dateStr = start.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: appt.business.timezone,
  });
  const timeStr = start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: appt.business.timezone,
  });

  const bookingPath = `/book/${appt.business.publicId}`;

  // Services display — use services[] array if available, fall back to service
  const servicesList: { name: string; price: number | null }[] =
    appt.services?.length ? appt.services : appt.service ? [appt.service] : [];
  const servicesLabel = servicesList.map(s => s.name).join(', ') || 'Appointment';
  const totalPrice = appt.totalPrice ?? servicesList.reduce((sum, s) => sum + (s.price ?? 0), 0);
  const hasPrice = totalPrice > 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">

        {/* Status icon */}
        <div className="mb-6">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
            isCancelled ? 'bg-red-100' : isPending ? 'bg-yellow-100' : 'bg-green-100'
          }`}>
            {isCancelled ? (
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : isPending ? (
              <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>

        {/* Heading */}
        {isCancelled ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Appointment Cancelled</h1>
            <p className="text-gray-600 mb-6">
              Your appointment has been cancelled. We hope to see you again soon!
            </p>
          </>
        ) : isPending ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Request Received!</h1>
            <p className="text-gray-600 mb-6">
              Your appointment request has been submitted. Check back here — this page will update automatically once the business confirms your booking.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h1>
            <p className="text-gray-600 mb-6">
              Your appointment is confirmed. We&apos;ve sent a confirmation to your phone.
            </p>
          </>
        )}

        {/* Details card */}
        <div className="bg-gray-50 rounded-xl p-6 mb-6 text-left">
          <h3 className="font-semibold text-gray-900 mb-4">Appointment Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Business:</span>
              <span className="font-medium">{appt.business.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{servicesList.length > 1 ? 'Services:' : 'Service:'}</span>
              <span className="font-medium text-right max-w-[60%]">{servicesLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Date:</span>
              <span className="font-medium">{dateStr}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Time:</span>
              <span className="font-medium">{timeStr}</span>
            </div>
            {appt.staff && (
              <div className="flex justify-between">
                <span className="text-gray-600">Staff:</span>
                <span className="font-medium">{appt.staff.fullName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Duration:</span>
              <span className="font-medium">{appt.duration} minutes</span>
            </div>
            {hasPrice && (
              <div className="flex justify-between">
                <span className="text-gray-600">Total:</span>
                <span className="font-medium">${totalPrice.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Status:</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                isCancelled ? 'bg-red-100 text-red-800' :
                isPending ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer text */}
        {(isConfirmed || (!isPending && !isCancelled)) && (
          <p className="text-sm text-gray-600 mb-6">
            Please arrive 5–10 minutes early. To reschedule, call us at{' '}
            <a href={`tel:${appt.business.phone}`} className="text-blue-600 hover:underline">
              {appt.business.phone}
            </a>
          </p>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <a
            href={bookingPath}
            className="block w-full bg-blue-600 text-white rounded-xl py-3 font-medium hover:bg-blue-700 transition-colors"
          >
            Book Another Appointment
          </a>

          {!isCancelled && (
            <>
              {!showCancelConfirm ? (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full border border-red-300 text-red-600 rounded-xl py-3 font-medium hover:bg-red-50 transition-colors"
                >
                  Cancel Appointment
                </button>
              ) : (
                <div className="border border-red-200 rounded-xl p-4 bg-red-50 text-left">
                  <p className="text-sm text-gray-700 mb-3 text-center">
                    Are you sure you want to cancel this appointment?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                      className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      Keep it
                    </button>
                    <button
                      onClick={() => cancelMutation.mutate()}
                      disabled={cancelMutation.isPending}
                      className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {cancelMutation.isPending ? 'Cancelling...' : 'Yes, cancel'}
                    </button>
                  </div>
                  {cancelMutation.isError && (
                    <p className="text-xs text-red-600 mt-2 text-center">
                      {cancelMutation.error instanceof Error
                        ? cancelMutation.error.message
                        : 'Failed to cancel'}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
