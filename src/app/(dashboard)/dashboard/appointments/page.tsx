'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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
  staff: {
    id: string;
    fullName: string;
  } | null;
}

function toDateStr(d: Date) {
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD
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

  const { data: staffData } = useQuery({
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
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Appointments</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{headerSubtitle}</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Appointment
        </button>
      </div>

      {/* Date Navigator + Stats */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-5 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="px-2 sm:px-4 text-center min-w-[130px] sm:min-w-[220px]">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{headerSubtitle}</p>
          </div>
          <button
            onClick={() => navigate(1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {!isToday && view === 'day' && (
            <button
              onClick={() => setSelectedDate(new Date())}
              className="ml-2 text-xs font-medium text-primary px-3 py-1.5 rounded-lg hover:bg-primary/5 border border-primary/20 transition-colors"
            >
              Today
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Quick stats */}
          {appointments.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 border-r border-gray-100 dark:border-gray-700 pr-4 mr-1">
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
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Staff</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.fullName}</option>
              ))}
            </select>
          )}

          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
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
      {isLoading ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-16 text-center">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400 dark:text-gray-500">Loading appointments…</p>
        </div>
      ) : view === 'day' ? (
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
                      <div key={a.id} className={`text-xs px-1 py-0.5 rounded truncate ${c.badge}`}>
                        {timeStr} {a.customer.name}
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

        {/* Main content — column on mobile, row on sm+ */}
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center">

          {/* Time + Customer */}
          <div className="flex items-center">
            {/* Time */}
            <div className="w-20 sm:w-28 flex-shrink-0 px-3 sm:px-4 py-3 sm:py-4">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone })}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 tabular-nums mt-0.5">
                {endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone })}
              </p>
              <p className="hidden sm:block text-xs text-gray-300 dark:text-gray-600 mt-0.5">{appointment.duration} min</p>
            </div>

            {/* Divider — desktop only */}
            <div className="hidden sm:block w-px h-12 bg-gray-100 dark:bg-gray-700 flex-shrink-0" />

            {/* Customer + Service */}
            <div className="flex-1 min-w-0 px-3 sm:px-5 py-3 sm:py-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{appointment.customer.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {appointment.service && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{appointment.service.name}</span>
                  )}
                  {appointment.staff && (
                    <>
                      {appointment.service && <span className="text-gray-300 dark:text-gray-600 text-xs">·</span>}
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
              </div>
            </div>
          </div>

          {/* Status + Actions — stacks below on mobile, inline on sm+ */}
          <div className="flex items-center gap-2 px-4 pb-3 sm:py-4 flex-shrink-0 flex-wrap">
            {appointment.notes && (
              <button
                onClick={() => setShowNotesModal(true)}
                title="View notes"
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors px-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
            )}
            {appointment.source === 'ai' && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                AI
              </span>
            )}
            {appointment.source === 'online' && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                Online
              </span>
            )}
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${config.badge}`}>
              {config.label}
            </span>

            {canConfirm ? (
              <div className="flex gap-1.5 sm:ml-2">
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
              </div>
            ) : canModify ? (
              <div className="flex gap-1.5 sm:ml-2">
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
              </div>
            ) : (
              <div className="hidden sm:block w-[100px] sm:ml-2" />
            )}
          </div>
        </div>
      </div>

      {showEditModal && <EditAppointmentModal appointment={appointment} onClose={() => setShowEditModal(false)} />}

      {showNotesModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowNotesModal(false)}>
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
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
    staffId: '',
    date: selectedDate.toLocaleDateString('en-CA'),
    time: '',
    duration: 60,
    notes: '',
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
  const services: any[] = servicesData?.services || [];
  const staffList: any[] = staffQueryData?.staff || [];
  const businessHours: any[] = businessHoursData?.businessHours || [];

  // Derive time slots from business hours for the selected date
  const { timeSlots, isClosed } = useMemo(() => {
    if (!businessHours.length || !formData.date) return { timeSlots: [], isClosed: false };
    const [year, month, day] = formData.date.split('-').map(Number);
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    const dayHours = businessHours.find((h: any) => h.dayOfWeek === dayOfWeek);
    if (!dayHours?.isOpen || !dayHours.openTime || !dayHours.closeTime) return { timeSlots: [], isClosed: true };
    const [openH, openM] = dayHours.openTime.split(':').map(Number);
    const [closeH, closeM] = dayHours.closeTime.split(':').map(Number);
    const slots: string[] = [];
    let h = openH, m = openM;
    while (h < closeH || (h === closeH && m < closeM)) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      m += 30;
      if (m >= 60) { m -= 60; h++; }
    }
    return { timeSlots: slots, isClosed: false };
  }, [businessHours, formData.date]);

  // Clear selected time when date changes so stale slot isn't kept
  useEffect(() => {
    setFormData(prev => ({ ...prev, time: '' }));
  }, [formData.date]);

  const formatSlot = (slot: string) => {
    const [h, m] = slot.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const todayStr = new Date().toLocaleDateString('en-CA');
  const tomorrowStr = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString('en-CA'); })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.time) { toast.error('Please select a time'); return; }
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
          serviceId: formData.serviceId || null,
          staffId: formData.staffId || null,
          startTime: startTime.toISOString(),
          duration: formData.duration,
          notes: formData.notes || null,
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">New Appointment</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <form id="new-appt-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 min-h-0">

            {/* Left: Date & Time */}
            <div className="p-5 space-y-5 border-r border-gray-100 dark:border-gray-700">

              {/* Date */}
              <div>
                <label className={labelClass}>Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="input text-sm"
                  required
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
                  <p className="text-xs text-gray-400 dark:text-gray-500 py-4 text-center">Loading hours…</p>
                ) : (
                  <div className="grid grid-cols-3 gap-1 max-h-[210px] overflow-y-auto pr-0.5">
                    {timeSlots.map(slot => (
                      <button
                        key={slot} type="button"
                        onClick={() => setFormData({ ...formData, time: slot })}
                        className={`text-xs py-2 rounded-lg border font-medium transition-colors ${
                          formData.time === slot
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary/40 hover:text-primary dark:hover:text-primary hover:bg-primary/5'
                        }`}
                      >
                        {formatSlot(slot)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Duration */}
              <div>
                <label className={labelClass}>Duration</label>
                <select
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                  className="input text-sm"
                >
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </div>
            </div>

            {/* Right: Details */}
            <div className="p-5 space-y-4">

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
                  <select
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    className="input text-sm"
                    required={customerMode === 'existing'}
                  >
                    <option value="">Select customer…</option>
                    {customers.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}{c.phone ? `  ·  ${c.phone}` : ''}</option>
                    ))}
                  </select>
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
              </div>

              {/* Service */}
              <div>
                <label className={labelClass}>Service</label>
                <select
                  value={formData.serviceId}
                  onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                  className="input text-sm"
                >
                  <option value="">No service</option>
                  {services.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Staff */}
              <div>
                <label className={labelClass}>Staff</label>
                <select
                  value={formData.staffId}
                  onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                  className="input text-sm"
                >
                  <option value="">Any available</option>
                  {staffList.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.fullName}</option>
                  ))}
                </select>
              </div>

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
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
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

  const [formData, setFormData] = useState({
    date: startTime.toLocaleDateString('en-CA'),
    time: `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`,
    duration: appointment.duration,
    notes: appointment.notes || '',
    status: appointment.status,
    source: appointment.source || 'dashboard',
  });

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
    const newStart = new Date(`${formData.date}T${formData.time}`);
    const newEnd = new Date(newStart.getTime() + formData.duration * 60000);
    updateMutation.mutate({ startTime: newStart.toISOString(), endTime: newEnd.toISOString(), duration: formData.duration, notes: formData.notes || null, status: formData.status, source: formData.source });
  };

  const initials = appointment.customer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 dark:border-gray-700">
        <div className="p-6">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Appointment</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-5 border border-gray-100 dark:border-gray-700">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary">{initials}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{appointment.customer.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {[appointment.service?.name, appointment.customer.phone].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Date *</label>
                <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="input" required />
              </div>
              <div>
                <label className="label">Time *</label>
                <input type="time" value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} className="input" required />
              </div>
            </div>
            <div>
              <label className="label">Duration *</label>
              <select value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })} className="input" required>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="input">
                <option value="pending">Pending</option>
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="no_show">No Show</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="label">Booked via</label>
              <select value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })} className="input">
                <option value="dashboard">Dashboard (manual)</option>
                <option value="online">Online booking</option>
                <option value="ai">AI receptionist</option>
              </select>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="input" rows={3} placeholder="Any special requests or notes…" />
            </div>
            <div className="flex gap-3 pt-2">
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
