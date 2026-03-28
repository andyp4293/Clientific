'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PublicOwnerBackButton } from '@/components/public/PublicOwnerBackButton';

type BatchAppointment = {
  id: string;
  status: string;
  startTime: string;
  duration: number;
  services: { id: string; name: string; price: number | null }[];
  totalPrice: number;
  staff: { fullName: string } | null;
  business: {
    name: string;
    phone: string;
    timezone: string;
    slug: string;
    publicId: string;
  };
};

type AppointmentBatchResponse = {
  batch: {
    business: BatchAppointment['business'];
    customerName: string;
    appointments: BatchAppointment[];
  };
  viewerCanManage: boolean;
};

const STATUS_STYLES: Record<string, string> = {
  pending:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  scheduled:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  confirmed:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled:
    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

function formatAppointmentStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function AppointmentBatchPage() {
  const params = useParams();
  const token = params.token as string;

  const { data, isLoading, error } = useQuery<AppointmentBatchResponse>({
    queryKey: ['appointment-batch', token],
    queryFn: async () => {
      const res = await fetch(`/api/public/appointment-batch/${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error('Appointment batch not found');
      return res.json();
    },
    refetchInterval: (query) => {
      const appointments = query.state.data?.batch?.appointments ?? [];
      return appointments.some((appointment) => appointment.status === 'pending') ? 30_000 : false;
    },
  });

  if (isLoading) {
    return (
      <div className="page-shell min-h-screen flex items-center justify-center">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !data?.batch) {
    return (
      <div className="page-shell min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            Appointment batch not found
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            This confirmation link may be invalid or expired.
          </p>
        </div>
      </div>
    );
  }

  const { batch, viewerCanManage } = data;
  const pendingCount = batch.appointments.filter((appointment) => appointment.status === 'pending').length;
  const confirmedCount = batch.appointments.filter((appointment) =>
    ['confirmed', 'scheduled'].includes(appointment.status)
  ).length;
  const cancelledCount = batch.appointments.filter((appointment) => appointment.status === 'cancelled').length;

  return (
    <div className="page-shell min-h-screen p-4 md:flex md:items-center md:justify-center">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        {viewerCanManage ? (
          <PublicOwnerBackButton
            fallbackHref="/dashboard/appointments"
            label="Back to appointments"
          />
        ) : null}

        <div className="rounded-3xl bg-white p-6 shadow-lg dark:bg-gray-800 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                Appointment Requests
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                {batch.customerName}, here are your appointment updates
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400">
                {batch.business.name} can confirm or decline each request separately. This page
                refreshes automatically while any request is still pending.
              </p>
            </div>
            <div className="min-w-[220px] rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                Current Status
              </p>
              <div className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <div className="flex items-center justify-between">
                  <span>Pending</span>
                  <span className="font-semibold">{pendingCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Accepted</span>
                  <span className="font-semibold">{confirmedCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Rejected / cancelled</span>
                  <span className="font-semibold">{cancelledCount}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {batch.appointments.map((appointment, index) => {
              const appointmentDate = new Date(appointment.startTime);
              const timezone = appointment.business.timezone;
              const servicesLabel =
                appointment.services.map((service) => service.name).join(', ') || 'Appointment';
              const dateLabel = appointmentDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                timeZone: timezone,
              });
              const timeLabel = appointmentDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                timeZone: timezone,
              });
              const statusClass = STATUS_STYLES[appointment.status] ?? STATUS_STYLES.pending;

              return (
                <div
                  key={appointment.id}
                  className="rounded-2xl border border-gray-200 bg-gray-50/80 p-5 dark:border-gray-700 dark:bg-gray-900/30"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                          Request {index + 1}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                          {formatAppointmentStatus(appointment.status)}
                        </span>
                      </div>
                      <h2 className="mt-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {servicesLabel}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                        {dateLabel} at {timeLabel}
                        {appointment.staff?.fullName ? ` with ${appointment.staff.fullName}` : ''}
                      </p>
                    </div>
                    <Link
                      href={`/appt/${appointment.id}`}
                      className="inline-flex items-center rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-white dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      Manage this appointment
                    </Link>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-gray-700 dark:text-gray-300 sm:grid-cols-3">
                    <div className="rounded-xl border border-gray-200 bg-white/80 px-3 py-3 dark:border-gray-700 dark:bg-gray-800/70">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                        Staff
                      </p>
                      <p className="mt-2 font-medium text-gray-900 dark:text-gray-100">
                        {appointment.staff?.fullName || 'Any available staff'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white/80 px-3 py-3 dark:border-gray-700 dark:bg-gray-800/70">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                        Duration
                      </p>
                      <p className="mt-2 font-medium text-gray-900 dark:text-gray-100">
                        {appointment.duration} minutes
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white/80 px-3 py-3 dark:border-gray-700 dark:bg-gray-800/70">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                        Total
                      </p>
                      <p className="mt-2 font-medium text-gray-900 dark:text-gray-100">
                        {appointment.totalPrice > 0 ? `$${appointment.totalPrice.toFixed(2)}` : 'To be confirmed'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
