'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@/components/ui/DatePicker';
import { TimePicker } from '@/components/ui/TimePicker';

interface BusinessHour {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
}

interface BusinessClosureDate {
  date: string;
  label: string | null;
}

interface BusinessHoursResponse {
  businessHours: BusinessHour[];
  closureDates: BusinessClosureDate[];
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SECTION_COPY = {
  hours: {
    eyebrow: 'Weekly Hours',
    title: 'Regular opening hours',
    description: 'Set the days and times customers can normally book each week.',
  },
  closures: {
    eyebrow: 'Closed Dates',
    title: 'Holiday and one-off closures',
    description:
      'Add future dates when your business is fully closed, even if your usual hours say you are open.',
  },
} as const;

type BusinessHoursSection = keyof typeof SECTION_COPY;

function formatClosureDate(date: string, timezone: string): string {
  return new Date(`${date}T12:00:00.000Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone || 'America/New_York',
  });
}

function parseDateOnly(value: string): Date | null {
  if (!value) return null;

  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

function formatDateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

export default function BusinessHoursPage() {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<BusinessHoursSection>('hours');
  const [hasChanges, setHasChanges] = useState(false);
  const [localHours, setLocalHours] = useState<BusinessHour[]>([]);
  const [localClosures, setLocalClosures] = useState<BusinessClosureDate[]>([]);
  const [timezone, setTimezone] = useState<string>('America/New_York');
  const [newClosureDate, setNewClosureDate] = useState('');
  const [newClosureLabel, setNewClosureLabel] = useState('');
  const [closureError, setClosureError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<BusinessHoursResponse>({
    queryKey: ['business-hours'],
    queryFn: async () => {
      const res = await fetch('/api/business-hours');
      if (!res.ok) throw new Error('Failed to fetch business hours');
      return res.json();
    },
  });

  const { data: businessData } = useQuery({
    queryKey: ['business-info'],
    queryFn: async () => {
      const res = await fetch('/api/business');
      if (!res.ok) throw new Error('Failed to fetch business info');
      return res.json();
    },
  });

  useEffect(() => {
    if (businessData?.business?.timezone) {
      setTimezone(businessData.business.timezone);
    }
  }, [businessData]);

  useEffect(() => {
    if (data && !hasChanges) {
      setLocalHours(data.businessHours ?? []);
      setLocalClosures(data.closureDates ?? []);
    }
  }, [data, hasChanges]);

  const savedHours = data?.businessHours ?? [];
  const savedClosures = data?.closureDates ?? [];
  const hasNoSavedHours = savedHours.length === 0;
  const timezoneLabel = timezone.replace(/_/g, ' ');
  const openDayCount = localHours.filter((hour) => hour.isOpen).length;
  const closureCount = localClosures.length;
  const newClosureDateValue = useMemo(() => parseDateOnly(newClosureDate), [newClosureDate]);
  const showActionBar = localHours.length > 0 || localClosures.length > 0 || hasChanges;
  const shouldHighlightFirstHoursSave = hasNoSavedHours && localHours.length > 0;
  const todayDateKey = useMemo(
    () =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()),
    [timezone]
  );
  const minClosureDate = useMemo(() => parseDateOnly(todayDateKey), [todayDateKey]);

  const updateMutation = useMutation({
    mutationFn: async ({
      hours,
      closures,
    }: {
      hours: BusinessHour[];
      closures: BusinessClosureDate[];
    }) => {
      const res = await fetch('/api/business-hours', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours, closures }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update business hours');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-hours'] });
      setHasChanges(false);
    },
  });

  const handleToggleDay = (dayIndex: number) => {
    setLocalHours((current) =>
      current.map((hour) =>
        hour.dayOfWeek === dayIndex
          ? {
              ...hour,
              isOpen: !hour.isOpen,
              openTime: !hour.isOpen && !hour.openTime ? '09:00' : hour.openTime,
              closeTime: !hour.isOpen && !hour.closeTime ? '17:00' : hour.closeTime,
            }
          : hour
      )
    );
    setHasChanges(true);
  };

  const handleTimeChange = (
    dayIndex: number,
    field: 'openTime' | 'closeTime',
    value: string
  ) => {
    setLocalHours((current) =>
      current.map((hour) =>
        hour.dayOfWeek === dayIndex ? { ...hour, [field]: value } : hour
      )
    );
    setHasChanges(true);
  };

  const handleAddClosure = () => {
    const trimmedDate = newClosureDate.trim();
    const trimmedLabel = newClosureLabel.trim().replace(/\s+/g, ' ');

    if (!trimmedDate) {
      setClosureError('Choose a date to close.');
      return;
    }

    if (localClosures.some((closure) => closure.date === trimmedDate)) {
      setClosureError('That closed date is already listed.');
      return;
    }

    setLocalClosures((current) =>
      [...current, { date: trimmedDate, label: trimmedLabel ? trimmedLabel.slice(0, 80) : null }]
        .sort((a, b) => a.date.localeCompare(b.date))
    );
    setNewClosureDate('');
    setNewClosureLabel('');
    setClosureError(null);
    setHasChanges(true);
  };

  const handleRemoveClosure = (date: string) => {
    setLocalClosures((current) => current.filter((closure) => closure.date !== date));
    setClosureError(null);
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate({ hours: localHours, closures: localClosures });
  };

  const handleReset = () => {
    setLocalHours(savedHours);
    setLocalClosures(savedClosures);
    setNewClosureDate('');
    setNewClosureLabel('');
    setClosureError(null);
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
          Business Hours & Closures
        </h1>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
          <p className="text-gray-600 dark:text-gray-400">
            Manage your regular schedule and any future closure dates customers should not be able to book.
          </p>
          <div className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
            <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="mr-1 text-gray-500 dark:text-gray-400">Timezone:</span>
            {timezoneLabel}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="card p-2">
            <button
              type="button"
              onClick={() => setActiveSection('hours')}
              className={`w-full rounded-2xl px-4 py-4 text-left transition-colors ${
                activeSection === 'hours'
                  ? 'bg-primary/10 text-gray-900 shadow-sm ring-1 ring-primary/20 dark:bg-primary/15 dark:text-gray-100 dark:ring-primary/30'
                  : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/80'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                    Weekly Hours
                  </p>
                  <h2 className="mt-2 text-base font-semibold">Regular opening times</h2>
                  <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-400">
                    Set the days and times customers can normally book each week.
                  </p>
                </div>
                <span className="rounded-full border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-500 dark:border-gray-700 dark:text-gray-300">
                  {openDayCount} open
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('closures')}
              className={`mt-2 w-full rounded-2xl px-4 py-4 text-left transition-colors ${
                activeSection === 'closures'
                  ? 'bg-primary/10 text-gray-900 shadow-sm ring-1 ring-primary/20 dark:bg-primary/15 dark:text-gray-100 dark:ring-primary/30'
                  : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/80'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                    Closed Dates
                  </p>
                  <h2 className="mt-2 text-base font-semibold">Holiday and one-off closures</h2>
                  <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-400">
                    Add future full-day closures that override your usual weekly schedule.
                  </p>
                </div>
                <span className="rounded-full border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-500 dark:border-gray-700 dark:text-gray-300">
                  {closureCount} set
                </span>
              </div>
            </button>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <div className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Both sections affect live booking
                </p>
                <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                  Online booking and your AI receptionist use both your weekly hours and your closed dates together.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
              {SECTION_COPY[activeSection].eyebrow}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
              {SECTION_COPY[activeSection].title}
            </h2>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              {SECTION_COPY[activeSection].description}
            </p>
          </div>

          {activeSection === 'hours' && (
            <>
              {hasNoSavedHours && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                  <div className="flex items-start gap-3">
                    <svg
                      className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                        No weekly hours configured yet
                      </p>
                      <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                        Set your regular weekly schedule first so customers can start booking.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="card">
                {localHours.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                      <svg
                        className="h-8 w-8 text-gray-400 dark:text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                      No weekly schedule yet
                    </h3>
                    <p className="mb-4 text-gray-600 dark:text-gray-400">
                      Set up your regular weekly hours to enable online bookings.
                    </p>
                    <button
                      onClick={() => {
                        setLocalHours(
                          DAYS.map((_, index) => ({
                            dayOfWeek: index,
                            isOpen: index >= 1 && index <= 5,
                            openTime: '09:00',
                            closeTime: '17:00',
                          }))
                        );
                        setHasChanges(true);
                      }}
                      className="btn-primary"
                    >
                      Set Up Weekly Hours
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {localHours.map((hour) => {
                      const dayName = DAYS[hour.dayOfWeek];
                      return (
                        <div key={hour.dayOfWeek} className="p-4 sm:p-6">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                            <div className="flex min-w-0 flex-1 items-center">
                              <input
                                type="checkbox"
                                id={`day-${hour.dayOfWeek}`}
                                checked={hour.isOpen}
                                onChange={() => handleToggleDay(hour.dayOfWeek)}
                                className="mr-3 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
                              />
                              <label
                                htmlFor={`day-${hour.dayOfWeek}`}
                                className={`cursor-pointer select-none text-base font-medium ${
                                  hour.isOpen
                                    ? 'text-gray-900 dark:text-gray-100'
                                    : 'text-gray-400 dark:text-gray-500'
                                }`}
                              >
                                {dayName}
                              </label>
                            </div>

                            {hour.isOpen ? (
                              <div className="flex w-full flex-col items-center gap-3 sm:ml-auto sm:w-auto sm:flex-row">
                                <div className="w-full sm:w-32">
                                  <TimePicker
                                    value={hour.openTime || '09:00'}
                                    onChange={(time) =>
                                      handleTimeChange(hour.dayOfWeek, 'openTime', time)
                                    }
                                  />
                                </div>
                                <span className="hidden text-gray-500 dark:text-gray-400 sm:inline">
                                  to
                                </span>
                                <div className="w-full sm:w-32">
                                  <TimePicker
                                    value={hour.closeTime || '17:00'}
                                    onChange={(time) =>
                                      handleTimeChange(hour.dayOfWeek, 'closeTime', time)
                                    }
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400 dark:text-gray-500 sm:ml-auto">
                                Closed
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {localHours.length > 0 && (
                <div className="card p-4 sm:p-6">
                  <h3 className="mb-3 font-semibold text-gray-900 dark:text-gray-100">
                    Quick Actions
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setLocalHours((current) =>
                          current.map((hour) => ({
                            ...hour,
                            isOpen: hour.dayOfWeek >= 1 && hour.dayOfWeek <= 5,
                            openTime: hour.dayOfWeek >= 1 && hour.dayOfWeek <= 5 ? '09:00' : null,
                            closeTime: hour.dayOfWeek >= 1 && hour.dayOfWeek <= 5 ? '17:00' : null,
                          }))
                        );
                        setHasChanges(true);
                      }}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Mon-Fri 9-5
                    </button>
                    <button
                      onClick={() => {
                        setLocalHours((current) =>
                          current.map((hour) => ({
                            ...hour,
                            isOpen: true,
                            openTime: '00:00',
                            closeTime: '23:59',
                          }))
                        );
                        setHasChanges(true);
                      }}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      24/7
                    </button>
                    <button
                      onClick={() => {
                        setLocalHours((current) =>
                          current.map((hour) => ({
                            ...hour,
                            isOpen: false,
                            openTime: null,
                            closeTime: null,
                          }))
                        );
                        setHasChanges(true);
                      }}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Close All
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {activeSection === 'closures' && (
            <div className="card p-4 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Specific Closed Dates
                  </h2>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Add holiday closures or one-off closed dates that should override your weekly hours.
                  </p>
                </div>
                <div className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  {localClosures.length} scheduled
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-200">
                Any date you add here is treated as closed for the full day on your booking page and by your AI receptionist.
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto]">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
                    Closed Date
                  </label>
                  <DatePicker
                    value={newClosureDateValue}
                    onChange={(date) => {
                      setNewClosureDate(formatDateOnly(date));
                      setClosureError(null);
                    }}
                    onClear={() => {
                      setNewClosureDate('');
                      setClosureError(null);
                    }}
                    allowClear
                    minDate={minClosureDate ?? undefined}
                    placeholder="Select closed date"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
                    Reason (Optional)
                  </label>
                  <input
                    type="text"
                    value={newClosureLabel}
                    onChange={(event) => {
                      setNewClosureLabel(event.target.value);
                      setClosureError(null);
                    }}
                    placeholder="Memorial Day"
                    maxLength={80}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleAddClosure}
                    className="w-full rounded-xl bg-primary px-5 py-3 font-medium text-white transition-colors hover:bg-primary-600 lg:w-auto"
                  >
                    Add Closed Date
                  </button>
                </div>
              </div>

              {closureError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                  {closureError}
                </div>
              )}

              <div className="mt-5">
                {localClosures.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400">
                    No one-off closed dates yet. Add future holidays or special closures here anytime.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {localClosures.map((closure) => (
                      <div
                        key={closure.date}
                        className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50/80 px-4 py-4 dark:border-gray-700 dark:bg-gray-800/70 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {formatClosureDate(closure.date, timezone)}
                          </p>
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            {closure.label ? closure.label : 'Closed all day'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveClosure(closure.date)}
                          className="inline-flex items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {localHours.length === 0 && (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
                  Set up your weekly hours too so customers have a regular schedule to book around.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {updateMutation.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">
            {updateMutation.error?.message || 'Failed to update business hours'}
          </p>
        </div>
      )}

      {showActionBar && (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {shouldHighlightFirstHoursSave && (
            <div className="mr-auto flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span className="font-medium">Click Save Changes to enable online bookings</span>
            </div>
          )}
          <button
            onClick={handleReset}
            disabled={!hasChanges || updateMutation.isPending}
            className="rounded-lg border border-gray-300 px-6 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
            className={`rounded-lg px-6 py-2.5 font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              shouldHighlightFirstHoursSave ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:bg-primary-600'
            }`}
          >
            {updateMutation.isPending ? (
              <span className="inline-flex items-center">
                <svg className="-ml-1 mr-2 h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Saving...
              </span>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
