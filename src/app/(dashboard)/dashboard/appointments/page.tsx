'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DashboardPageLoading } from '@/components/layout/DashboardPageLoading';
import { DatePicker } from '@/components/ui/DatePicker';
import { CustomSelect } from '@/components/ui/CustomSelect';
import {
  buildAppointmentStartOptions,
  getEffectiveStaffDayHours,
  normalizeBusinessHoursRecord,
  type StaffWorkHoursRecord,
} from '@/lib/staff-schedule';

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: string;
  source: string;
  notes: string | null;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  };
  service: {
    id: string;
    name: string;
  } | null;
  serviceDisplayName?: string | null;
  services?: Array<{
    id: string;
    name: string;
  }>;
  staff: {
    id: string;
    fullName: string;
  } | null;
}

interface StaffOption {
  id: string;
  fullName: string;
  serviceIds?: string[];
  workDays?: number[];
  workHours?: StaffWorkHoursRecord;
}

interface ServiceOption {
  id: string;
  name: string;
  duration: number;
}

interface BusinessHour {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
}

function toDateStr(d: Date) {
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD
}

function fromDateStr(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // back to Sunday
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 7); // exclusive (next Sunday)
  return end;
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1); // exclusive
}

function groupByDay(appointments: Appointment[], timezone: string): Record<string, Appointment[]> {
  const groups: Record<string, Appointment[]> = {};
  for (const appt of appointments) {
    const key = new Date(appt.startTime).toLocaleDateString('en-CA', { timeZone: timezone });
    if (!groups[key]) groups[key] = [];
    groups[key].push(appt);
  }
  return groups;
}

function getAppointmentServiceLabel(appointment: Pick<Appointment, 'serviceDisplayName' | 'service'>) {
  return appointment.serviceDisplayName || appointment.service?.name || null;
}

function timeToMinutes(value: string | null | undefined) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

const STATUS_CONFIG: Record<string, { label: string; badge: string; bar: string }> = {
  pending:   { label: 'Pending',   badge: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',   bar: 'bg-amber-400' },
  scheduled: { label: 'Scheduled', badge: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',      bar: 'bg-blue-500' },
  confirmed: { label: 'Confirmed', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800', bar: 'bg-emerald-500' },
  completed: { label: 'Completed', badge: 'bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600',     bar: 'bg-gray-300' },
  cancelled: { label: 'Cancelled', badge: 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',         bar: 'bg-red-400' },
  no_show:   { label: 'No Show',   badge: 'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800', bar: 'bg-orange-400' },
};

export default function AppointmentsPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const queryClient = useQueryClient();

  const localDateStr = toDateStr(selectedDate);
  const weekStartStr = toDateStr(getWeekStart(selectedDate));
  const weekEndStr = toDateStr(getWeekEnd(selectedDate));
  const monthStartStr = toDateStr(getMonthStart(selectedDate));
  const monthEndStr = toDateStr(getMonthEnd(selectedDate));

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', view, view === 'day' ? localDateStr : view === 'week' ? weekStartStr : monthStartStr],
    queryFn: async () => {
      let url: string;
      if (view === 'day') {
        url = `/api/appointments?date=${localDateStr}`;
      } else if (view === 'week') {
        url = `/api/appointments?startDate=${weekStartStr}&endDate=${weekEndStr}`;
      } else {
        url = `/api/appointments?startDate=${monthStartStr}&endDate=${monthEndStr}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch appointments');
      return res.json();
    },
  });

  const { data: staffData, isLoading: isLoadingStaff } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const res = await fetch('/api/staff');
      if (!res.ok) throw new Error('Failed to fetch staff');
      return res.json();
    },
  });

  const appointments: Appointment[] = data?.appointments || [];
  const timezone: string = data?.timezone || 'America/New_York';
  const staffList: { id: string; fullName: string }[] = staffData?.staff || [];
  const isToday = selectedDate.toDateString() === new Date().toDateString();

  const filteredAppointments = selectedStaffId
    ? appointments.filter(a => a.staff?.id === selectedStaffId)
    : appointments;

  if (isLoading || isLoadingStaff) {
    return <DashboardPageLoading />;
  }

  const counts = {
    confirmed: filteredAppointments.filter(a => a.status === 'confirmed').length,
    pending: filteredAppointments.filter(a => a.status === 'pending').length,
    scheduled: filteredAppointments.filter(a => a.status === 'scheduled').length,
  };

  const headerSubtitle = view === 'day'
    ? (isToday ? 'Today' : selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))
    : view === 'week'
    ? (() => {
        const ws = getWeekStart(selectedDate);
        const we = new Date(ws); we.setDate(ws.getDate() + 6);
        return `${ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      })()
    : selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const navigate = (dir: 1 | -1) => {
    const d = new Date(selectedDate);
    if (view === 'day') d.setDate(d.getDate() + dir);
    else if (view === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setSelectedDate(d);
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Appointments</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{headerSubtitle}</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="btn-primary inline-flex w-full items-center justify-center gap-2 text-sm sm:w-auto"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Appointment
        </button>
      </div>

      {/* Date Navigator + Stats */}
      <div className="mb-5 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800 sm:p-4">
        {/* Date navigation — full width on mobile */}
        <div className="flex items-center gap-1 w-full">
          <button
            onClick={() => navigate(-1)}
            aria-label="Previous period"
            className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0 flex-1 sm:flex-none sm:min-w-[220px] px-2 text-center">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{headerSubtitle}</p>
          </div>
          <button
            onClick={() => navigate(1)}
            aria-label="Next period"
            className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {!isToday && view === 'day' && (
            <button
              onClick={() => setSelectedDate(new Date())}
              aria-label="Jump to today"
              className="ml-1 text-xs font-medium text-primary px-3 py-1.5 rounded-lg hover:bg-primary/5 border border-primary/20 transition-colors flex-shrink-0"
            >
              Today
            </button>
          )}
        </div>

        {/* Controls — full width on mobile */}
        <div className="mt-3 flex flex-col gap-2 sm:mt-0 sm:flex-row sm:items-center sm:gap-3">
          {/* Quick stats */}
          {appointments.length > 0 && (
            <div className="flex w-full flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 sm:w-auto sm:border-r sm:border-gray-100 sm:pr-3 dark:sm:border-gray-700">
              <span className="font-semibold text-gray-900 dark:text-gray-100">{filteredAppointments.length}</span> total
              {counts.pending > 0 && (
                <span className="bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-full font-medium">
                  {counts.pending} pending
                </span>
              )}
              {counts.confirmed > 0 && (
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-full font-medium">
                  {counts.confirmed} confirmed
                </span>
              )}
            </div>
          )}

          {/* Staff filter */}
          {staffList.length > 0 && (
            <div className="w-full sm:w-auto">
              <CustomSelect
                value={selectedStaffId}
                onChange={(val) => setSelectedStaffId(val)}
                className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="All Staff"
                options={staffList.map(s => ({ value: s.id, label: s.fullName }))}
              />
            </div>
          )}

          {/* View toggle — stretches full width on mobile */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden w-full sm:w-auto">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  view === v ? 'bg-primary text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Appointments */}
      {view === 'day' ? (
        filteredAppointments.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-16 text-center">
            <div className="w-12 h-12 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {selectedStaffId ? 'No appointments for this staff member' : 'No appointments scheduled'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">
              {selectedStaffId ? 'Try selecting a different staff member or clearing the filter.' : 'Nothing booked for this day yet.'}
            </p>
            {!selectedStaffId && <button onClick={() => setShowNewModal(true)} className="btn-primary text-sm">+ New Appointment</button>}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
            {filteredAppointments.map((appointment) => (
              <AppointmentRow key={appointment.id} appointment={appointment} timezone={timezone} />
            ))}
          </div>
        )
      ) : view === 'week' ? (
        <WeekView
          selectedDate={selectedDate}
          appointments={filteredAppointments}
          selectedStaffId={selectedStaffId}
          timezone={timezone}
          onNewAppointment={() => setShowNewModal(true)}
          onDayClick={(d) => { setSelectedDate(d); setView('day'); }}
        />
      ) : (
        <MonthView
          selectedDate={selectedDate}
          appointments={filteredAppointments}
          timezone={timezone}
          onDayClick={(d) => { setSelectedDate(d); setView('day'); }}
        />
      )}

      {showNewModal && (
        <NewAppointmentModal onClose={() => setShowNewModal(false)} selectedDate={selectedDate} />
      )}
    </div>
  );
}

function WeekView({
  selectedDate,
  appointments,
  selectedStaffId,
  timezone,
  onNewAppointment,
  onDayClick,
}: {
  selectedDate: Date;
  appointments: Appointment[];
  selectedStaffId: string;
  timezone: string;
  onNewAppointment: () => void;
  onDayClick: (d: Date) => void;
}) {
  const weekStart = getWeekStart(selectedDate);
  const grouped = groupByDay(appointments, timezone);
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone });

  return (
    <div className="space-y-3">
      {Array.from({ length: 7 }, (_, i) => {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + i);
        const dayStr = toDateStr(day);
        const dayAppts = grouped[dayStr] || [];
        const isToday = dayStr === todayStr;

        return (
          <div key={dayStr}>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => onDayClick(day)}
                className={`text-sm font-semibold hover:underline ${isToday ? 'text-primary' : 'text-gray-700 dark:text-gray-300'}`}
              >
                {day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </button>
              {isToday && <span className="text-xs bg-primary text-white px-1.5 py-0.5 rounded-full">Today</span>}
              {dayAppts.length > 0 && (
                <span className="text-xs text-gray-400 dark:text-gray-500">{dayAppts.length} appointment{dayAppts.length > 1 ? 's' : ''}</span>
              )}
            </div>
            {dayAppts.length > 0 ? (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
                {dayAppts.map(a => <AppointmentRow key={a.id} appointment={a} timezone={timezone} />)}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 flex items-center justify-between">
                <p className="text-xs text-gray-400 dark:text-gray-500">No appointments</p>
                {isToday && !selectedStaffId && (
                  <button onClick={onNewAppointment} className="text-xs text-primary hover:underline font-medium">+ Add</button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MonthView({
  selectedDate,
  appointments,
  timezone,
  onDayClick,
}: {
  selectedDate: Date;
  appointments: Appointment[];
  timezone: string;
  onDayClick: (d: Date) => void;
}) {
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grouped = groupByDay(appointments, timezone);
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone });

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">{d}</div>
        ))}
      </div>
      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {/* Leading empty cells */}
        {Array.from({ length: firstDayOfMonth }, (_, i) => (
          <div key={`e${i}`} className="min-h-[80px] border-b border-r border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/20" />
        ))}
        {/* Day cells */}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = new Date(year, month, i + 1);
          const dayStr = toDateStr(day);
          const dayAppts = grouped[dayStr] || [];
          const isToday = dayStr === todayStr;

          return (
            <div
              key={dayStr}
              onClick={() => onDayClick(day)}
              className={`min-h-[80px] border-b border-r border-gray-100 dark:border-gray-700 p-2 cursor-pointer transition-colors ${
                isToday ? 'bg-primary/5 dark:bg-primary/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-sm font-medium ${
                isToday ? 'bg-primary text-white' : 'text-gray-700 dark:text-gray-300'
              }`}>
                {i + 1}
              </span>
              {dayAppts.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {dayAppts.slice(0, 2).map(a => {
                    const c = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.scheduled;
                    const timeStr = new Date(a.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone });
                    return (
                      <div key={a.id} className={`rounded px-1 py-1 text-xs leading-tight ${c.badge}`}>
                        <div className="truncate font-medium">
                          {timeStr} {a.customer.name}
                        </div>
                        {a.staff?.fullName ? (
                          <div className="truncate opacity-80">
                            with {a.staff.fullName}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {dayAppts.length > 2 && (
                    <div className="text-xs text-gray-400 dark:text-gray-500 pl-1">+{dayAppts.length - 2} more</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AppointmentRow({ appointment, timezone }: { appointment: Appointment; timezone: string }) {
  const queryClient = useQueryClient();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const startTime = new Date(appointment.startTime);
  const endTime = new Date(appointment.endTime);
  const config = STATUS_CONFIG[appointment.status] ?? STATUS_CONFIG.scheduled;
  const initials = appointment.customer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const serviceLabel = getAppointmentServiceLabel(appointment);

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); setShowCancelConfirm(false); },
    onError: (e: any) => toast.error(e.message || 'Failed to cancel'),
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
    onError: (e: any) => toast.error(e.message || 'Failed to confirm'),
  });

  const canConfirm = appointment.status === 'pending';
  const canModify = ['pending', 'scheduled', 'confirmed'].includes(appointment.status);

  return (
    <>
      <div className="flex gap-0 hover:bg-gray-50/60 dark:hover:bg-gray-700/60 transition-colors group">
        {/* Status bar */}
        <div className={`w-1 self-stretch flex-shrink-0 ${config.bar}`} />

        {/* ── MOBILE LAYOUT (hidden on sm+) ── */}
        <div className="flex-1 min-w-0 sm:hidden px-3 py-3 space-y-2">
          {/* Row 1: time · name · status badge */}
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 w-14 pt-0.5">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-tight">
                {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone })}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums leading-tight mt-0.5">
                {endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone })}
              </p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{appointment.customer.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {serviceLabel && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">{serviceLabel}</span>
                )}
                {appointment.staff && (
                  <>
                    {serviceLabel && <span className="text-gray-300 dark:text-gray-600 text-xs">·</span>}
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{appointment.staff.fullName}</span>
                  </>
                )}
                {appointment.customer.phone && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600 text-xs">·</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{appointment.customer.phone}</span>
                  </>
                )}
              </div>
              {appointment.notes && (
                <button
                  onClick={() => setShowNotesModal(true)}
                  className="flex items-center gap-1 mt-1 text-left w-full group/notes"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 flex-shrink-0 text-amber-500 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 group-hover/notes:text-amber-700 dark:group-hover/notes:text-amber-300 truncate transition-colors">
                    {appointment.notes.length > 55 ? appointment.notes.slice(0, 55) + '…' : appointment.notes}
                  </span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {appointment.source === 'ai' && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">AI</span>
              )}
              {appointment.source === 'online' && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Online</span>
              )}
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${config.badge}`}>{config.label}</span>
            </div>
          </div>
          {/* Row 2: action buttons */}
          {(canConfirm || canModify) && (
            <div className="flex items-center gap-2 pl-16">
              {canConfirm ? (
                <>
                  <button
                    onClick={() => confirmMutation.mutate()}
                    disabled={confirmMutation.isPending}
                    className="text-xs font-medium px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {confirmMutation.isPending ? '…' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={cancelMutation.isPending}
                    className="text-xs font-medium px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    Decline
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="text-xs font-medium px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="text-xs font-medium px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-red-500 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── DESKTOP LAYOUT (hidden on mobile) ── */}
        <div className="flex-1 min-w-0 hidden sm:flex sm:items-center">
          {/* Time */}
          <div className="w-28 flex-shrink-0 px-4 py-4">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">
              {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone })}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 tabular-nums mt-0.5">
              {endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone })}
            </p>
            <p className="text-xs text-gray-300 dark:text-gray-600 mt-0.5">{appointment.duration} min</p>
          </div>
          {/* Divider */}
          <div className="w-px h-12 bg-gray-100 dark:bg-gray-700 flex-shrink-0" />
          {/* Customer + Service */}
          <div className="flex-1 min-w-0 px-5 py-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{appointment.customer.name}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {serviceLabel && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">{serviceLabel}</span>
                )}
                {appointment.staff && (
                  <>
                    {serviceLabel && <span className="text-gray-300 dark:text-gray-600 text-xs">·</span>}
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{appointment.staff.fullName}</span>
                  </>
                )}
                {appointment.customer.phone && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600 text-xs">·</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{appointment.customer.phone}</span>
                  </>
                )}
              </div>
              {appointment.notes && (
                <button
                  onClick={() => setShowNotesModal(true)}
                  className="flex items-center gap-1 mt-1.5 text-left max-w-full group/notes"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 flex-shrink-0 text-amber-500 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-xs text-amber-600 dark:text-amber-400 group-hover/notes:text-amber-700 dark:group-hover/notes:text-amber-300 truncate transition-colors">
                    {appointment.notes.length > 55 ? appointment.notes.slice(0, 55) + '…' : appointment.notes}
                  </span>
                </button>
              )}
            </div>
          </div>
          {/* Status + Actions */}
          <div className="flex items-center gap-2 px-4 py-4 flex-shrink-0">
            {appointment.source === 'ai' && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">AI</span>
            )}
            {appointment.source === 'online' && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Online</span>
            )}
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${config.badge}`}>{config.label}</span>
            {canConfirm ? (
              <div className="flex gap-1.5 ml-2">
                <button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending} className="text-xs font-medium px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                  {confirmMutation.isPending ? '…' : 'Confirm'}
                </button>
                <button onClick={() => setShowCancelConfirm(true)} disabled={cancelMutation.isPending} className="text-xs font-medium px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors">
                  Decline
                </button>
              </div>
            ) : canModify ? (
              <div className="flex gap-1.5 ml-2">
                <button onClick={() => setShowEditModal(true)} className="text-xs font-medium px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Edit
                </button>
                <button onClick={() => setShowCancelConfirm(true)} className="text-xs font-medium px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-red-500 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800 transition-colors">
                  Cancel
                </button>
              </div>
            ) : (
              <div className="w-[100px] ml-2" />
            )}
          </div>
        </div>
      </div>

      {showEditModal && <EditAppointmentModal appointment={appointment} onClose={() => setShowEditModal(false)} />}

      {showNotesModal && (
        <div data-mobile-overlay="true" className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70] p-4" onClick={() => setShowNotesModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-sm w-full p-5 shadow-2xl border border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notes</h3>
              <button onClick={() => setShowNotesModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{appointment.notes}</p>
          </div>
        </div>
      )}

      {showCancelConfirm && (
        <div data-mobile-overlay="true" className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Cancel appointment?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              <strong className="text-gray-700 dark:text-gray-300">{appointment.customer.name}</strong> on{' '}
              {startTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: timezone })} at{' '}
              {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone })}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowCancelConfirm(false)} disabled={cancelMutation.isPending} className="flex-1 btn-outline text-sm">
                Keep
              </button>
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="flex-1 bg-red-600 text-white text-sm rounded-lg px-4 py-2 hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
              >
                {cancelMutation.isPending ? 'Cancelling…' : 'Cancel Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NewAppointmentModal({ onClose, selectedDate }: { onClose: () => void; selectedDate: Date }) {
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    customerId: '',
    newCustomerName: '',
    newCustomerPhone: '',
    serviceId: '',
    serviceIds: [] as string[],
    serviceStaffAssignments: {} as Record<string, string>,
    staffId: '',
    date: selectedDate.toLocaleDateString('en-CA'),
    time: '',
    duration: 60,
    notes: '',
    appointmentSmsConsent: false,
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => { const res = await fetch('/api/customers'); if (!res.ok) throw new Error(); return res.json(); },
  });
  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: async () => { const res = await fetch('/api/services'); if (!res.ok) throw new Error(); return res.json(); },
  });
  const { data: staffQueryData } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => { const res = await fetch('/api/staff'); if (!res.ok) throw new Error(); return res.json(); },
  });

  const { data: businessHoursData } = useQuery({
    queryKey: ['business-hours'],
    queryFn: async () => { const res = await fetch('/api/business-hours'); if (!res.ok) throw new Error(); return res.json(); },
  });

  const customers: any[] = customersData?.customers || [];
  const services: ServiceOption[] = servicesData?.services || [];
  const staffList: StaffOption[] = staffQueryData?.staff || [];
  const selectedServiceIds = formData.serviceIds.length
    ? formData.serviceIds
    : formData.serviceId
      ? [formData.serviceId]
      : [];
  const selectedServices = selectedServiceIds
    .map((serviceId) => services.find((service) => service.id === serviceId))
    .filter((service): service is ServiceOption => Boolean(service));
  const selectedService = selectedServices[0] ?? null;
  const effectiveDuration = selectedServices.length
    ? selectedServices.reduce((sum, service) => sum + service.duration, 0)
    : formData.duration;
  const getEligibleStaffForService = (serviceId: string) =>
    staffList.filter(
      (staffMember) => !staffMember.serviceIds?.length || staffMember.serviceIds.includes(serviceId)
    );
  const serviceStaffAssignments = selectedServiceIds.map((serviceId) => ({
    serviceId,
    staffId: formData.serviceStaffAssignments[serviceId] || '',
  }));
  const assignedStaffIds = Array.from(
    new Set(serviceStaffAssignments.map((assignment) => assignment.staffId).filter(Boolean))
  );
  const businessHours: BusinessHour[] = businessHoursData?.businessHours || [];
  const businessHoursRecord = useMemo(
    () =>
      normalizeBusinessHoursRecord(
        Object.fromEntries(
          businessHours.map((hour) => [
            hour.dayOfWeek,
            {
              isOpen: hour.isOpen,
              openTime: hour.openTime,
              closeTime: hour.closeTime,
            },
          ])
        )
      ),
    [businessHours]
  );

  // Fetch the day once so multi-service bookings can check each assigned employee segment.
  const { data: dayApptData } = useQuery({
    queryKey: ['appointment-day-conflicts', formData.date],
    queryFn: async () => {
      const res = await fetch(`/api/appointments?date=${formData.date}`);
      if (!res.ok) return { appointments: [] };
      return res.json();
    },
    enabled: assignedStaffIds.length > 0 && !!formData.date,
  });

  // Derive time slots from business hours for the selected date
  const { timeSlots, isClosed, emptyMessage } = useMemo(() => {
    if (!formData.date) return { timeSlots: [], isClosed: false, emptyMessage: 'Select a date to view times.' };
    const [year, month, day] = formData.date.split('-').map(Number);
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    const dayHours = businessHoursRecord[dayOfWeek];
    if (!dayHours?.isOpen || !dayHours.openTime || !dayHours.closeTime) {
      return { timeSlots: [], isClosed: true, emptyMessage: 'Closed on this day' };
    }

    let openTime = dayHours.openTime;
    let closeTime = dayHours.closeTime;

    const singleAssignedStaffId =
      selectedServiceIds.length === 1 ? serviceStaffAssignments[0]?.staffId : '';

    if (singleAssignedStaffId) {
      const selectedStaff = getEligibleStaffForService(selectedServiceIds[0]).find(
        (staffMember) => staffMember.id === singleAssignedStaffId
      );
      if (!selectedStaff) {
        return { timeSlots: [], isClosed: false, emptyMessage: 'Choose a valid staff member.' };
      }

      const staffHours = getEffectiveStaffDayHours({
        dayOfWeek,
        workDays: selectedStaff.workDays ?? [],
        workHours: selectedStaff.workHours,
        businessHours: businessHoursRecord,
      });

      if (!staffHours.worksDay || !staffHours.startTime || !staffHours.endTime) {
        return {
          timeSlots: [],
          isClosed: false,
          emptyMessage: `${selectedStaff.fullName} is not working during business hours on this day.`,
        };
      }

      openTime = staffHours.startTime;
      closeTime = staffHours.endTime;
    }

    const baseSlots = buildAppointmentStartOptions(openTime, closeTime, effectiveDuration);
    const filteredSlots = baseSlots.filter((slot) => {
      if (selectedServices.length <= 1) return true;

      const slotStartMinutes = timeToMinutes(slot);
      if (slotStartMinutes === null) return false;

      let cursor: number = slotStartMinutes;

      for (const service of selectedServices) {
        const staffId = formData.serviceStaffAssignments[service.id];
        const segmentStart = cursor;
        const segmentEnd = cursor + service.duration;
        cursor = segmentEnd;

        if (!staffId) continue;

        const staffMember = getEligibleStaffForService(service.id).find(
          (candidate) => candidate.id === staffId
        );
        if (!staffMember) return false;

        const staffHours = getEffectiveStaffDayHours({
          dayOfWeek,
          workDays: staffMember.workDays ?? [],
          workHours: staffMember.workHours,
          businessHours: businessHoursRecord,
        });
        const staffStart = timeToMinutes(staffHours.startTime);
        const staffEnd = timeToMinutes(staffHours.endTime);

        if (!staffHours.worksDay || staffStart === null || staffEnd === null) return false;
        if (segmentStart < staffStart || segmentEnd > staffEnd) return false;
      }

      return true;
    });

    return {
      timeSlots: filteredSlots,
      isClosed: false,
      emptyMessage: 'No times available for this schedule.',
    };
  }, [
    businessHoursRecord,
    effectiveDuration,
    formData.date,
    formData.serviceStaffAssignments,
    selectedServiceIds,
    selectedServices,
    serviceStaffAssignments,
    staffList,
  ]);

  // Compute which slots are blocked by the selected staff's existing appointments
  const blockedSlots = useMemo(() => {
    if (!assignedStaffIds.length || !dayApptData?.appointments?.length) return new Set<string>();
    const blocked = new Set<string>();

    for (const slot of timeSlots) {
      const baseStart = new Date(`${formData.date}T${slot}`);
      let cursorMs = baseStart.getTime();
      const segmentsToCheck = selectedServices.length
        ? selectedServices.map((service) => {
            const segmentStart = cursorMs;
            const segmentEnd = segmentStart + service.duration * 60000;
            cursorMs = segmentEnd;
            return {
              staffId: formData.serviceStaffAssignments[service.id] || '',
              startMs: segmentStart,
              endMs: segmentEnd,
            };
          })
        : [
            {
              staffId: formData.staffId,
              startMs: baseStart.getTime(),
              endMs: baseStart.getTime() + effectiveDuration * 60000,
            },
          ];

      for (const segment of segmentsToCheck) {
        if (!segment.staffId) continue;

        for (const appt of dayApptData.appointments) {
          if (!['pending', 'scheduled', 'confirmed'].includes(appt.status)) continue;
          if (appt.staff?.id !== segment.staffId) continue;

          const apptStart = new Date(appt.startTime).getTime();
          const apptEnd = new Date(appt.endTime).getTime();
          if (segment.startMs < apptEnd && segment.endMs > apptStart) {
            blocked.add(slot);
            break;
          }
        }
      }
    }
    return blocked;
  }, [
    assignedStaffIds.length,
    dayApptData,
    effectiveDuration,
    formData.date,
    formData.serviceStaffAssignments,
    formData.staffId,
    selectedServices,
    timeSlots,
  ]);

  // Clear selected time when date changes so stale slot isn't kept
  useEffect(() => {
    setFormData(prev => ({ ...prev, time: '' }));
  }, [formData.date]);

  useEffect(() => {
    if (!services.length || selectedServiceIds.length) return;
    const [defaultService] = services;
    setFormData((prev) => ({
      ...prev,
      serviceId: defaultService.id,
      serviceIds: [defaultService.id],
      duration: defaultService.duration,
      time: '',
    }));
  }, [services, selectedServiceIds.length]);

  // Clear selected time if it becomes blocked (staff changed, duration changed, etc.)
  useEffect(() => {
    if (formData.time && blockedSlots.has(formData.time)) {
      setFormData(prev => ({ ...prev, time: '' }));
    }
  }, [blockedSlots, formData.time]);

  useEffect(() => {
    if (formData.time && !timeSlots.includes(formData.time)) {
      setFormData((prev) => ({ ...prev, time: '' }));
    }
  }, [formData.time, timeSlots]);

  useEffect(() => {
    const nextAssignments = { ...formData.serviceStaffAssignments };
    let changed = false;

    for (const serviceId of selectedServiceIds) {
      const staffId = nextAssignments[serviceId];
      if (!staffId) continue;
      if (getEligibleStaffForService(serviceId).some((staffMember) => staffMember.id === staffId)) {
        continue;
      }

      delete nextAssignments[serviceId];
      changed = true;
    }

    if (!changed) return;

    setFormData((prev) => ({
      ...prev,
      serviceStaffAssignments: nextAssignments,
      staffId: '',
      time: '',
    }));
  }, [formData.serviceStaffAssignments, selectedServiceIds, staffList]);

  const formatSlot = (slot: string) => {
    const [h, m] = slot.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const todayStr = new Date().toLocaleDateString('en-CA');
  const tomorrowStr = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString('en-CA'); })();
  const selectedCustomer = customerMode === 'existing'
    ? customers.find((customer: any) => customer.id === formData.customerId)
    : null;
  const selectedCustomerPhone = selectedCustomer?.phone?.trim() || '';
  const manualConsentPhone = customerMode === 'new'
    ? formData.newCustomerPhone.trim()
    : selectedCustomerPhone;

  useEffect(() => {
    if (customerMode !== 'existing') return;

    const shouldEnableAppointmentSms = Boolean(
      selectedCustomer?.smsConsent && !selectedCustomer?.smsOptedOut
    );

    setFormData((prev) =>
      prev.appointmentSmsConsent === shouldEnableAppointmentSms
        ? prev
        : { ...prev, appointmentSmsConsent: shouldEnableAppointmentSms }
    );
  }, [
    customerMode,
    selectedCustomer?.id,
    selectedCustomer?.smsConsent,
    selectedCustomer?.smsOptedOut,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServiceIds.length) { toast.error('Please select at least one service'); return; }
    if (!formData.time) { toast.error('Please select a time'); return; }
    if (formData.appointmentSmsConsent && !manualConsentPhone) {
      toast.error('Add a phone number before enabling appointment texts');
      return;
    }
    setSubmitting(true);
    try {
      let customerId = formData.customerId;
      if (customerMode === 'new') {
        if (!formData.newCustomerName.trim()) { toast.error('Customer name is required'); setSubmitting(false); return; }
        const custRes = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formData.newCustomerName.trim(), phone: formData.newCustomerPhone.trim() || null }),
        });
        if (!custRes.ok) { const e = await custRes.json(); toast.error(e.error || 'Failed to create customer'); setSubmitting(false); return; }
        const custData = await custRes.json();
        customerId = custData.customer.id;
      }
      const startTime = new Date(`${formData.date}T${formData.time}`);
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          serviceId: selectedServiceIds[0] || null,
          serviceIds: selectedServiceIds,
          staffId:
            selectedServiceIds.length === 1
              ? formData.serviceStaffAssignments[selectedServiceIds[0]] || null
              : null,
          serviceStaffAssignments: selectedServiceIds.map((serviceId) => ({
            serviceId,
            staffId: formData.serviceStaffAssignments[serviceId] || null,
          })),
          startTime: startTime.toISOString(),
          duration: effectiveDuration,
          notes: formData.notes || null,
          appointmentSmsConsent: formData.appointmentSmsConsent,
          source: 'dashboard',
        }),
      });
      if (res.ok) { toast.success('Appointment created'); onClose(); window.location.reload(); }
      else { const error = await res.json(); toast.error(error.error || 'Failed to create appointment'); }
    } catch { toast.error('Failed to create appointment'); }
    finally { setSubmitting(false); }
  };

  const labelClass = 'block text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5';

  return (
    <div data-mobile-overlay="true" className="fixed inset-0 z-[70] bg-black/50 p-0 sm:flex sm:items-center sm:justify-center sm:p-4">
      <div className="flex h-[100dvh] w-full flex-col bg-white shadow-2xl dark:bg-gray-800 sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-gray-100 dark:border-gray-700">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 pt-[calc(env(safe-area-inset-top)+1rem)] dark:border-gray-700 flex-shrink-0 sm:px-6 sm:pt-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">New Appointment</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <form id="new-appt-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="grid min-h-0 grid-cols-1 md:grid-cols-2">

            {/* Left: Date & Time */}
            <div className="space-y-5 border-b border-gray-100 p-4 dark:border-gray-700 md:border-b-0 md:border-r md:p-5">

              {/* Date */}
              <div>
                <label className={labelClass}>Date</label>
                <DatePicker
                  value={fromDateStr(formData.date)}
                  onChange={(date) => setFormData({ ...formData, date: toDateStr(date) })}
                />
                <div className="flex gap-1.5 mt-2">
                  {[{ label: 'Today', val: todayStr }, { label: 'Tomorrow', val: tomorrowStr }].map(({ label, val }) => (
                    <button
                      key={label} type="button"
                      onClick={() => setFormData({ ...formData, date: val })}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                        formData.date === val
                          ? 'bg-primary text-white border-primary'
                          : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-primary/40 hover:text-primary'
                      }`}
                    >{label}</button>
                  ))}
                </div>
              </div>

              {/* Time slots */}
              <div>
                <label className={labelClass}>
                  Time
                  {formData.time && (
                    <span className="normal-case font-semibold text-primary ml-1">— {formatSlot(formData.time)}</span>
                  )}
                </label>
                {isClosed ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500 py-4 text-center">Closed on this day</p>
                ) : timeSlots.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500 py-4 text-center">{emptyMessage || 'No times available for this schedule.'}</p>
                ) : (
                  <div className="grid grid-cols-3 gap-1 max-h-[210px] overflow-y-auto pr-0.5">
                    {timeSlots.map(slot => {
                      const isBlocked = blockedSlots.has(slot);
                      const isSelected = formData.time === slot;
                      return (
                        <button
                          key={slot} type="button"
                          disabled={isBlocked}
                          onClick={() => !isBlocked && setFormData({ ...formData, time: slot })}
                          title={isBlocked ? 'Already booked' : undefined}
                          className={`text-xs py-2 rounded-lg border font-medium transition-colors ${
                            isBlocked
                              ? 'border-gray-100 dark:border-gray-700 text-gray-300 dark:text-gray-600 bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed line-through'
                              : isSelected
                                ? 'bg-primary text-white border-primary shadow-sm'
                                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary/40 hover:text-primary dark:hover:text-primary hover:bg-primary/5'
                          }`}
                        >
                          {formatSlot(slot)}
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedServices.length > 1 ? (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Times reserve {effectiveDuration} minutes and check each assigned employee&apos;s consecutive segment.
                  </p>
                ) : null}
              </div>

              {/* Duration */}
              <div>
                <label className={labelClass}>Duration</label>
                <CustomSelect
                  value={String(effectiveDuration)}
                  onChange={(val) => setFormData({ ...formData, duration: parseInt(val) })}
                  className="input text-sm"
                  disabled={selectedServices.length > 0}
                  options={[
                    { value: '15', label: '15 min' },
                    { value: '30', label: '30 min' },
                    { value: '45', label: '45 min' },
                    { value: '60', label: '1 hour' },
                    { value: '90', label: '1.5 hours' },
                    { value: '120', label: '2 hours' },
                  ]}
                />
                {selectedServices.length ? (
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    Service-based booking uses the combined {effectiveDuration}-minute length from the selected services.
                  </p>
                ) : null}
              </div>
            </div>

            {/* Right: Details */}
            <div className="space-y-4 p-4 md:p-5">

              {/* Customer */}
              <div>
                <label className={labelClass}>Customer</label>
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden mb-2.5 text-xs">
                  {(['existing', 'new'] as const).map((mode) => (
                    <button
                      key={mode} type="button"
                      onClick={() => setCustomerMode(mode)}
                      className={`flex-1 py-1.5 font-medium capitalize transition-colors ${
                        customerMode === mode
                          ? 'bg-primary text-white'
                          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {mode === 'existing' ? 'Existing' : 'New'}
                    </button>
                  ))}
                </div>
                {customerMode === 'existing' ? (
                  <CustomSelect
                    value={formData.customerId}
                    onChange={(val) => setFormData({ ...formData, customerId: val })}
                    className="input text-sm"
                    placeholder="Select customer…"
                    searchable
                    searchPlaceholder="Search by name or phone"
                    noResultsLabel="No customers match that search"
                    required={customerMode === 'existing'}
                    options={customers.map((c: any) => ({ value: c.id, label: c.name + (c.phone ? `  ·  ${c.phone}` : '') }))}
                  />
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text" placeholder="Full name *"
                      value={formData.newCustomerName}
                      onChange={(e) => setFormData({ ...formData, newCustomerName: e.target.value })}
                      className="input text-sm"
                      required={customerMode === 'new'}
                    />
                    <input
                      type="tel" placeholder="Phone (optional)"
                      value={formData.newCustomerPhone}
                      onChange={(e) => setFormData({ ...formData, newCustomerPhone: e.target.value })}
                      className="input text-sm"
                    />
                  </div>
                )}
                <label className="mt-3 flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/80 p-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={formData.appointmentSmsConsent}
                    disabled={customerMode === 'existing' && !selectedCustomer}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        appointmentSmsConsent: e.target.checked,
                      }))
                    }
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/40 dark:border-gray-600 dark:bg-gray-800"
                  />
                  <span className="space-y-1">
                    <span className="block font-medium text-gray-900 dark:text-gray-100">
                      Customer verbally agreed to appointment texts
                    </span>
                    <span className="block text-xs leading-5 text-gray-500 dark:text-gray-400">
                      Sends the appointment request now, then future confirmation and reminder texts for this phone number. Reply STOP to opt out.
                    </span>
                    {customerMode === 'existing' && !selectedCustomer ? (
                      <span className="block text-xs text-gray-400 dark:text-gray-500">
                        Select a customer first to enable appointment texts.
                      </span>
                    ) : null}
                    {customerMode === 'existing' && selectedCustomer && !selectedCustomerPhone ? (
                      <span className="block text-xs text-amber-600 dark:text-amber-400">
                        This customer needs a phone number before appointment texts can be enabled.
                      </span>
                    ) : null}
                  </span>
                </label>
              </div>

              {/* Services */}
              <div>
                <label className={labelClass}>Services</label>
                <p className="mb-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                  Select one or more services. Multiple services run consecutively in the order you pick them.
                </p>
                <div className="flex flex-wrap gap-2">
                  {services.map((service) => {
                    const selected = selectedServiceIds.includes(service.id);
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => {
                          setFormData((prev) => {
                            const alreadySelected = prev.serviceIds.includes(service.id);
                            const nextServiceIds = alreadySelected
                              ? prev.serviceIds.filter((serviceId) => serviceId !== service.id)
                              : [...prev.serviceIds, service.id];
                            const nextAssignments = { ...prev.serviceStaffAssignments };
                            if (alreadySelected) {
                              delete nextAssignments[service.id];
                            }
                            const nextPrimary = nextServiceIds[0] || '';
                            return {
                              ...prev,
                              serviceId: nextPrimary,
                              serviceIds: nextServiceIds,
                              serviceStaffAssignments: nextAssignments,
                              staffId: nextPrimary ? nextAssignments[nextPrimary] || '' : '',
                              duration:
                                nextServiceIds.length === 0
                                  ? prev.duration
                                  : nextServiceIds.reduce((sum, selectedId) => {
                                      const selected = services.find((entry) => entry.id === selectedId);
                                      return sum + (selected?.duration ?? 0);
                                    }, 0),
                              time: '',
                            };
                          });
                        }}
                        className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                          selected
                            ? 'border-primary bg-primary text-white shadow-sm'
                            : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-primary/40 hover:text-primary dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200'
                        }`}
                      >
                        <span className="block">{service.name}</span>
                        <span className={`block text-[11px] ${selected ? 'text-white/80' : 'text-gray-400 dark:text-gray-500'}`}>
                          {service.duration} min
                        </span>
                      </button>
                    );
                  })}
                </div>
                {selectedServices.length ? (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs leading-5 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                    Total appointment length: {effectiveDuration} minutes across {selectedServices.length} service{selectedServices.length === 1 ? '' : 's'}.
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    Select at least one service before creating the appointment.
                  </p>
                )}
              </div>

              {/* Staff per service */}
              {selectedServices.length ? (
                <div>
                  <label className={labelClass}>Staff by service</label>
                  <div className="space-y-2">
                    {selectedServices.map((service, index) => {
                      const eligibleStaffForService = getEligibleStaffForService(service.id);
                      return (
                        <div
                          key={service.id}
                          className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-900/40"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {index + 1}. {service.name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {service.duration} min, then the next service starts automatically.
                              </p>
                            </div>
                          </div>
                          <CustomSelect
                            value={formData.serviceStaffAssignments[service.id] || ''}
                            onChange={(val) =>
                              setFormData((prev) => ({
                                ...prev,
                                serviceStaffAssignments: {
                                  ...prev.serviceStaffAssignments,
                                  [service.id]: val,
                                },
                                staffId: index === 0 ? val : prev.staffId,
                                time: '',
                              }))
                            }
                            className="input text-sm"
                            placeholder="Any available"
                            options={eligibleStaffForService.map((staffMember) => ({
                              value: staffMember.id,
                              label: staffMember.fullName,
                            }))}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Notes */}
              <div>
                <label className={labelClass}>Notes <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input text-sm resize-none"
                  rows={3}
                  placeholder="Special requests or notes…"
                />
              </div>
            </div>

          </div>
        </form>

        {/* Footer */}
        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] dark:border-gray-700 flex-shrink-0 sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:pb-4">
          <button type="button" onClick={onClose} className="btn-outline text-sm px-5">Cancel</button>
          <button type="submit" form="new-appt-form" disabled={submitting} className="btn-primary text-sm px-6 disabled:opacity-60">
            {submitting ? 'Creating…' : 'Create Appointment'}
          </button>
        </div>

      </div>
    </div>
  );
}

function EditAppointmentModal({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  const queryClient = useQueryClient();
  const startTime = new Date(appointment.startTime);
  const serviceLabel = getAppointmentServiceLabel(appointment);
  const initialServiceId = appointment.service?.id || appointment.services?.[0]?.id || '';

  const [formData, setFormData] = useState({
    date: startTime.toLocaleDateString('en-CA'),
    time: `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`,
    serviceId: initialServiceId,
    staffId: appointment.staff?.id || '',
    duration: appointment.duration,
    notes: appointment.notes || '',
    status: appointment.status,
    source: appointment.source || 'dashboard',
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: async () => { const res = await fetch('/api/services'); if (!res.ok) throw new Error(); return res.json(); },
  });
  const { data: staffQueryData } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => { const res = await fetch('/api/staff'); if (!res.ok) throw new Error(); return res.json(); },
  });
  const { data: businessHoursData } = useQuery({
    queryKey: ['business-hours'],
    queryFn: async () => { const res = await fetch('/api/business-hours'); if (!res.ok) throw new Error(); return res.json(); },
  });

  const services: ServiceOption[] = servicesData?.services || [];
  const staffList: StaffOption[] = staffQueryData?.staff || [];
  const businessHours: BusinessHour[] = businessHoursData?.businessHours || [];
  const selectedService = services.find((service) => service.id === formData.serviceId) ?? null;
  const eligibleStaff = selectedService
    ? staffList.filter(
        (staffMember) =>
          !staffMember.serviceIds?.length || staffMember.serviceIds.includes(selectedService.id)
      )
    : staffList;
  const businessHoursRecord = useMemo(
    () =>
      normalizeBusinessHoursRecord(
        Object.fromEntries(
          businessHours.map((hour) => [
            hour.dayOfWeek,
            {
              isOpen: hour.isOpen,
              openTime: hour.openTime,
              closeTime: hour.closeTime,
            },
          ])
        )
      ),
    [businessHours]
  );

  const { data: staffApptData } = useQuery({
    queryKey: ['staff-appointments', formData.staffId, formData.date],
    queryFn: async () => {
      const res = await fetch(`/api/appointments?staffId=${formData.staffId}&date=${formData.date}`);
      if (!res.ok) return { appointments: [] };
      return res.json();
    },
    enabled: !!formData.staffId && !!formData.date,
  });

  const { timeSlots, emptyMessage } = useMemo(() => {
    if (!formData.date) return { timeSlots: [], emptyMessage: 'Select a date to view times.' };
    const [year, month, day] = formData.date.split('-').map(Number);
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    const dayHours = businessHoursRecord[dayOfWeek];
    if (!dayHours?.isOpen || !dayHours.openTime || !dayHours.closeTime) {
      return { timeSlots: [], emptyMessage: 'Closed on this day' };
    }

    let openTime = dayHours.openTime;
    let closeTime = dayHours.closeTime;

    if (formData.staffId) {
      const selectedStaff = eligibleStaff.find((staffMember) => staffMember.id === formData.staffId);
      if (!selectedStaff) {
        return { timeSlots: [], emptyMessage: 'Choose a valid staff member.' };
      }

      const staffHours = getEffectiveStaffDayHours({
        dayOfWeek,
        workDays: selectedStaff.workDays ?? [],
        workHours: selectedStaff.workHours,
        businessHours: businessHoursRecord,
      });

      if (!staffHours.worksDay || !staffHours.startTime || !staffHours.endTime) {
        return {
          timeSlots: [],
          emptyMessage: `${selectedStaff.fullName} is not working during business hours on this day.`,
        };
      }

      openTime = staffHours.startTime;
      closeTime = staffHours.endTime;
    }

    return {
      timeSlots: buildAppointmentStartOptions(openTime, closeTime, formData.duration),
      emptyMessage: 'No times available for this schedule.',
    };
  }, [businessHoursRecord, eligibleStaff, formData.date, formData.duration, formData.staffId]);

  const blockedSlots = useMemo(() => {
    if (!formData.staffId || !staffApptData?.appointments?.length) return new Set<string>();
    const blocked = new Set<string>();
    const durationMs = formData.duration * 60000;
    for (const slot of timeSlots) {
      const slotStart = new Date(`${formData.date}T${slot}`).getTime();
      const slotEnd = slotStart + durationMs;
      for (const appt of staffApptData.appointments) {
        if (appt.id === appointment.id || !['scheduled', 'confirmed'].includes(appt.status)) continue;
        const apptStart = new Date(appt.startTime).getTime();
        const apptEnd = new Date(appt.endTime).getTime();
        if (slotStart < apptEnd && slotEnd > apptStart) {
          blocked.add(slot);
          break;
        }
      }
    }
    return blocked;
  }, [appointment.id, formData.staffId, formData.date, formData.duration, staffApptData, timeSlots]);

  const formatSlot = (slot: string) => {
    const [h, m] = slot.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const timeOptions = useMemo(() => {
    const options = formData.time && !timeSlots.includes(formData.time)
      ? [formData.time, ...timeSlots]
      : timeSlots;

    return options.map((slot) => ({
      value: slot,
      label: `${formatSlot(slot)}${slot === formData.time && !timeSlots.includes(slot) ? ' (current)' : ''}`,
    }));
  }, [formData.time, timeSlots]);

  useEffect(() => {
    if (
      !formData.staffId ||
      eligibleStaff.some((staffMember) => staffMember.id === formData.staffId)
    ) {
      return;
    }

    setFormData((prev) => ({ ...prev, staffId: '', time: '' }));
  }, [eligibleStaff, formData.staffId]);

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); onClose(); },
    onError: (e: any) => toast.error(e.message || 'Failed to update appointment'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (blockedSlots.has(formData.time)) {
      toast.error('Choose another time. This staff member is already booked then.');
      return;
    }
    const newStart = new Date(`${formData.date}T${formData.time}`);
    const newEnd = new Date(newStart.getTime() + formData.duration * 60000);
    updateMutation.mutate({
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
      duration: formData.duration,
      serviceId: formData.serviceId || null,
      serviceIds: formData.serviceId ? [formData.serviceId] : [],
      staffId: formData.staffId || null,
      notes: formData.notes || null,
      status: formData.status,
      source: formData.source,
    });
  };

  const initials = appointment.customer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div data-mobile-overlay="true" className="fixed inset-0 z-[70] bg-black/40 p-0 sm:flex sm:items-center sm:justify-center sm:p-4">
      <div className="flex h-[100dvh] w-full flex-col bg-white shadow-2xl dark:bg-gray-800 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-xl sm:border sm:border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 pt-[calc(env(safe-area-inset-top)+1rem)] dark:border-gray-700 sm:border-b-0 sm:px-6 sm:pb-0 sm:pt-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Appointment</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:pb-6 sm:pt-5">
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-5 border border-gray-100 dark:border-gray-700">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary">{initials}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{appointment.customer.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {[serviceLabel, appointment.customer.phone].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>

          <form id="edit-appointment-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Date *</label>
                <DatePicker
                  value={fromDateStr(formData.date)}
                  onChange={(date) => setFormData({ ...formData, date: toDateStr(date) })}
                />
              </div>
              <div>
                <label className="label">Time *</label>
                <CustomSelect
                  value={formData.time}
                  onChange={(val) => setFormData({ ...formData, time: val })}
                  className="input"
                  placeholder={emptyMessage || 'Choose time'}
                  required
                  options={timeOptions}
                />
                {blockedSlots.has(formData.time) ? (
                  <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                    This staff member is already booked at that time. Choose another slot before saving.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Service</label>
                <CustomSelect
                  value={formData.serviceId}
                  onChange={(val) => {
                    const service = services.find((entry) => entry.id === val) ?? null;
                    const staffForService = service
                      ? staffList.filter(
                          (staffMember) =>
                            !staffMember.serviceIds?.length || staffMember.serviceIds.includes(service.id)
                        )
                      : staffList;
                    setFormData((prev) => ({
                      ...prev,
                      serviceId: val,
                      duration: service?.duration ?? prev.duration,
                      staffId:
                        prev.staffId && service
                          ? staffForService.some((staffMember) => staffMember.id === prev.staffId)
                            ? prev.staffId
                            : ''
                          : prev.staffId,
                      time: '',
                    }));
                  }}
                  className="input"
                  placeholder="No service"
                  options={services.map((service) => ({ value: service.id, label: service.name }))}
                />
                {selectedService ? (
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    Duration follows {selectedService.name}: {selectedService.duration} minutes.
                  </p>
                ) : null}
              </div>
              <div>
                <label className="label">Staff</label>
                <CustomSelect
                  value={formData.staffId}
                  onChange={(val) => setFormData({ ...formData, staffId: val, time: '' })}
                  className="input"
                  placeholder="Any available"
                  options={eligibleStaff.map((staffMember) => ({
                    value: staffMember.id,
                    label: staffMember.fullName,
                  }))}
                />
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs leading-5 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
              If this booking came from online booking, the AI receptionist, or SMS booking and the
              customer allows appointment texts, Clientific will text them when the service, staff,
              or time changes.
            </div>
            <div>
              <label className="label">Duration *</label>
              <CustomSelect
                value={String(formData.duration)}
                onChange={(val) => setFormData({ ...formData, duration: parseInt(val) })}
                className="input"
                disabled={Boolean(selectedService)}
                required
                options={[
                  { value: '15', label: '15 minutes' },
                  { value: '30', label: '30 minutes' },
                  { value: '45', label: '45 minutes' },
                  { value: '60', label: '1 hour' },
                  { value: '90', label: '1.5 hours' },
                  { value: '120', label: '2 hours' },
                ]}
              />
              {selectedService ? (
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  Change the service to change the appointment length.
                </p>
              ) : null}
            </div>
            <div>
              <label className="label">Status</label>
              <CustomSelect
                value={formData.status}
                onChange={(val) => setFormData({ ...formData, status: val })}
                className="input"
                options={[
                  { value: 'pending', label: 'Pending' },
                  { value: 'scheduled', label: 'Scheduled' },
                  { value: 'confirmed', label: 'Confirmed' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'no_show', label: 'No Show' },
                  { value: 'cancelled', label: 'Cancelled' },
                ]}
              />
            </div>
            <div>
              <label className="label">Booked via</label>
              <CustomSelect
                value={formData.source}
                onChange={(val) => setFormData({ ...formData, source: val })}
                className="input"
                options={[
                  { value: 'dashboard', label: 'Dashboard (manual)' },
                  { value: 'online', label: 'Online booking' },
                  { value: 'ai', label: 'AI receptionist' },
                ]}
              />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="input" rows={3} placeholder="Any special requests or notes…" />
            </div>
            <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-3 border-t border-gray-100 bg-white px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] dark:border-gray-700 dark:bg-gray-800 sm:mx-0 sm:flex-row sm:border-t-0 sm:px-0 sm:pb-0 sm:pt-2">
              <button type="button" onClick={onClose} disabled={updateMutation.isPending} className="flex-1 btn-outline">Cancel</button>
              <button type="submit" disabled={updateMutation.isPending} className="flex-1 btn-primary">
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
