import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { ClientificLogo } from '@/components/brand/ClientificLogo';
import { APP_NAME } from '@/lib/brand';
import { collectAppointmentServiceIds, withAppointmentServiceDisplay } from '@/lib/appointment-services';
import { prisma } from '@/lib/prisma';
import { businessDayStart } from '@/lib/timezone';

function formatLocalDate(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replaceAll('/', '-');
}

function formatDateLabel(dateKey: string, timezone: string) {
  return businessDayStart(dateKey, timezone).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  });
}

function formatTimeLabel(value: Date, timezone: string) {
  return value.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
}

function statusClasses(status: string) {
  if (status === 'confirmed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-300';
  }

  if (status === 'pending') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/25 dark:text-amber-300';
  }

  return 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300';
}

function formatStatus(status: string) {
  return status
    .split('_')
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');
}

export default async function StaffAppointmentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/login');
  }

  if (session.user.accountType !== 'staff' || !session.user.staffId) {
    redirect('/dashboard');
  }
  if (session.user.staffPasswordChangeRequired) {
    redirect('/staff/set-password');
  }

  const staff = await prisma.staff.findFirst({
    where: {
      id: session.user.staffId,
      businessId: session.user.businessId,
      active: true,
      portalAccessEnabled: true,
    },
    select: {
      id: true,
      fullName: true,
      role: true,
      business: {
        select: {
          id: true,
          name: true,
          timezone: true,
        },
      },
    },
  });

  if (!staff) {
    redirect('/signout');
  }

  const params = (await searchParams) ?? {};
  const timezone = staff.business.timezone;
  const todayKey = formatLocalDate(new Date(), timezone);
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '')
    ? params.date!
    : todayKey;
  const startOfDay = businessDayStart(selectedDate, timezone);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      businessId: staff.business.id,
      staffId: staff.id,
      startTime: {
        gte: startOfDay,
        lt: endOfDay,
      },
      status: { in: ['pending', 'scheduled', 'confirmed'] },
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
        },
      },
      service: {
        select: {
          id: true,
          name: true,
        },
      },
      staff: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
    orderBy: { startTime: 'asc' },
  });

  const upcomingStart = new Date();
  const upcomingEnd = new Date(upcomingStart.getTime() + 14 * 24 * 60 * 60 * 1000);
  const upcomingAppointments = await prisma.appointment.findMany({
    where: {
      businessId: staff.business.id,
      staffId: staff.id,
      startTime: {
        gte: upcomingStart,
        lt: upcomingEnd,
      },
      status: { in: ['pending', 'scheduled', 'confirmed'] },
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
        },
      },
      service: {
        select: {
          id: true,
          name: true,
        },
      },
      staff: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
    orderBy: { startTime: 'asc' },
    take: 12,
  });

  const serviceIds = collectAppointmentServiceIds([...appointments, ...upcomingAppointments]);
  const services = serviceIds.length
    ? await prisma.service.findMany({
        where: { id: { in: serviceIds }, businessId: staff.business.id },
        select: { id: true, name: true },
      })
    : [];
  const appointmentsWithServices = withAppointmentServiceDisplay(appointments, services);
  const upcomingAppointmentsWithServices = withAppointmentServiceDisplay(
    upcomingAppointments,
    services,
  );
  const previousDate = new Date(startOfDay);
  previousDate.setDate(previousDate.getDate() - 1);
  const nextDate = new Date(startOfDay);
  nextDate.setDate(nextDate.getDate() + 1);

  return (
    <main className="min-h-screen brand-shell px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center">
            <ClientificLogo
              className="inline-flex items-center gap-2"
              markClassName="h-9 w-9 text-gray-950 dark:text-white"
              nameClassName="text-2xl font-bold text-gray-900 dark:text-gray-100"
              title={APP_NAME}
            />
          </Link>
          <Link
            href="/signout"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-primary/40 hover:text-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-primary/50 dark:hover:text-primary-300"
          >
            Sign out
          </Link>
        </header>

        <section className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="border-b border-gray-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-6 py-7 dark:border-gray-800 dark:from-emerald-950/40 dark:via-gray-950 dark:to-teal-950/30 sm:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">
              Employee schedule
            </p>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-gray-950 dark:text-white sm:text-4xl">
                  {formatDateLabel(selectedDate, timezone)}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
                  {staff.fullName}
                  {staff.role ? `, ${staff.role}` : ''} can see assigned appointments only.
                  Customer phone numbers and CRM details stay private to the business owner.
                </p>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary dark:border-primary/30 dark:bg-primary/15 dark:text-primary-200">
                Phone numbers hidden
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-b border-gray-100 p-4 dark:border-gray-800 sm:grid-cols-3 sm:p-6">
            <Link
              href={`/staff/appointments?date=${formatLocalDate(previousDate, timezone)}`}
              className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-sm font-bold text-gray-700 transition hover:border-primary/40 hover:text-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              Previous day
            </Link>
            <Link
              href="/staff/appointments"
              className="rounded-2xl border border-primary bg-primary px-4 py-3 text-center text-sm font-bold text-white shadow-[0_14px_34px_-22px_rgba(24,166,120,0.9)] transition hover:bg-primary-600"
            >
              Today
            </Link>
            <Link
              href={`/staff/appointments?date=${formatLocalDate(nextDate, timezone)}`}
              className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-sm font-bold text-gray-700 transition hover:border-primary/40 hover:text-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              Next day
            </Link>
          </div>

          <div className="p-4 sm:p-6">
            {appointmentsWithServices.length ? (
              <div className="space-y-3">
                {appointmentsWithServices.map((appointment) => (
                  <article
                    key={appointment.id}
                    className="rounded-3xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900/70"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-gray-950 dark:text-white">
                          {formatTimeLabel(appointment.startTime, timezone)} -{' '}
                          {formatTimeLabel(appointment.endTime, timezone)}
                        </p>
                        <h2 className="mt-2 text-2xl font-black tracking-tight text-gray-950 dark:text-white">
                          {appointment.customer.name}
                        </h2>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${statusClasses(appointment.status)}`}
                      >
                        {formatStatus(appointment.status)}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                          Service
                        </p>
                        <p className="mt-1 font-semibold text-gray-950 dark:text-white">
                          {appointment.serviceDisplayName || appointment.service?.name || 'Service'}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                          Duration
                        </p>
                        <p className="mt-1 font-semibold text-gray-950 dark:text-white">
                          {appointment.duration} minutes
                        </p>
                      </div>
                    </div>
                    {appointment.notes ? (
                      <div className="mt-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                          Notes
                        </p>
                        <p className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-300">
                          {appointment.notes}
                        </p>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 px-6 py-14 text-center dark:border-gray-700 dark:bg-gray-900/70">
                <p className="text-2xl font-black text-gray-950 dark:text-white">
                  No assigned appointments
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600 dark:text-gray-400">
                  When the owner assigns bookings to {staff.fullName}, they will appear here without
                  exposing customer phone numbers.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">
                Upcoming
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-gray-950 dark:text-white">
                Next assigned appointments
              </h2>
            </div>
            <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-bold text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              {upcomingAppointmentsWithServices.length} in 14 days
            </span>
          </div>

          {upcomingAppointmentsWithServices.length ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {upcomingAppointmentsWithServices.map((appointment) => (
                <article
                  key={appointment.id}
                  className="rounded-3xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/70"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                        {appointment.startTime.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          timeZone: timezone,
                        })}
                      </p>
                      <p className="mt-1 text-lg font-black text-gray-950 dark:text-white">
                        {formatTimeLabel(appointment.startTime, timezone)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${statusClasses(appointment.status)}`}
                    >
                      {formatStatus(appointment.status)}
                    </span>
                  </div>
                  <h3 className="mt-3 text-xl font-black tracking-tight text-gray-950 dark:text-white">
                    {appointment.customer.name}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-gray-300">
                    {appointment.serviceDisplayName || appointment.service?.name || 'Service'}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-3xl border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-center text-sm font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-400">
              No upcoming assigned appointments in the next 14 days.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
