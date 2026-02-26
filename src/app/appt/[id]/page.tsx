'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import Link from 'next/link';

interface Appointment {
  id: string;
  status: string;
  startTime: string;
  endTime: string;
  duration: number;
  notes: string | null;
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

function statusMessage(status: string) {
  if (status === 'confirmed') return 'Your appointment has been confirmed!';
  if (status === 'cancelled') return 'This appointment has been cancelled.';
  return "Your appointment has been sent to the owner but you need to wait for their confirmation.";
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
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !data?.appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Appointment not found</h1>
          <p className="text-gray-500 text-sm">This link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  const appt: Appointment = cancelMutation.isSuccess
    ? { ...data.appointment, status: 'cancelled' }
    : data.appointment;

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
    hour12: true,
    timeZone: appt.business.timezone,
  });

  const isCancelled = appt.status === 'cancelled';
  const bookingPath = `/book/${appt.business.publicId}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md overflow-hidden">
        {/* Top checkmark / X */}
        <div className="flex flex-col items-center pt-8 pb-4 px-6 text-center">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              isCancelled ? 'bg-red-100' : 'bg-green-500'
            }`}
          >
            {isCancelled ? (
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>

          <p className="text-sm text-gray-700 leading-snug mb-4">
            {statusMessage(appt.status)}
          </p>

          <p className="font-bold text-gray-900 text-base">{appt.business.name}</p>
          <a
            href={`tel:${appt.business.phone}`}
            className="text-blue-500 text-sm mt-0.5 hover:underline"
          >
            {appt.business.phone}
          </a>
        </div>

        <hr className="border-gray-200 mx-6" />

        {/* Service & Staff */}
        <div className="px-6 py-4 text-center">
          <p className="font-bold text-gray-900 text-base">
            {appt.service?.name || 'Appointment'}{' '}
            <span className="font-normal text-gray-700">
              by {appt.staff?.fullName || 'Any Staff'}
            </span>
          </p>
        </div>

        <hr className="border-gray-200 mx-6" />

        {/* Date & Time */}
        <div className="px-6 py-4 text-center">
          <p className="font-bold text-gray-900">{dateStr}</p>
          <p className="font-bold text-gray-900 mt-1">{timeStr}</p>
        </div>

        {/* Buttons */}
        {!isCancelled && (
          <div className="px-6 pb-6 space-y-3">
            <Link
              href={bookingPath}
              className="block w-full py-3 rounded-xl bg-indigo-500 text-white font-semibold text-sm text-center hover:bg-indigo-600 transition-colors"
            >
              Book another appointment
            </Link>

            {!showCancelConfirm ? (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="block w-full py-3 rounded-xl bg-red-500 text-white font-semibold text-sm text-center hover:bg-red-600 transition-colors"
              >
                Cancel appointment
              </button>
            ) : (
              <div className="border border-red-200 rounded-xl p-4 bg-red-50">
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
                    {cancelMutation.error instanceof Error ? cancelMutation.error.message : 'Failed to cancel'}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {isCancelled && (
          <div className="px-6 pb-6">
            <Link
              href={bookingPath}
              className="block w-full py-3 rounded-xl bg-indigo-500 text-white font-semibold text-sm text-center hover:bg-indigo-600 transition-colors"
            >
              Book another appointment
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
