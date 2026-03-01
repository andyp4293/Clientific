'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: string;
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
  const queryClient = useQueryClient();

  const localDateStr = selectedDate.toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', localDateStr],
    queryFn: async () => {
      const res = await fetch(`/api/appointments?date=${localDateStr}`);
      if (!res.ok) throw new Error('Failed to fetch appointments');
      return res.json();
    },
  });

  const appointments: Appointment[] = data?.appointments || [];
  const isToday = selectedDate.toDateString() === new Date().toDateString();

  const counts = {
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    pending: appointments.filter(a => a.status === 'pending').length,
    scheduled: appointments.filter(a => a.status === 'scheduled').length,
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Appointments</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
            {isToday ? 'Today' : selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
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
            onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="px-4 text-center min-w-[180px]">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{selectedDate.getFullYear()}</p>
          </div>
          <button
            onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {!isToday && (
            <button
              onClick={() => setSelectedDate(new Date())}
              className="ml-2 text-xs font-medium text-primary px-3 py-1.5 rounded-lg hover:bg-primary/5 border border-primary/20 transition-colors"
            >
              Today
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Quick stats */}
          {appointments.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 border-r border-gray-100 dark:border-gray-700 pr-4 mr-1">
              <span className="font-semibold text-gray-900 dark:text-gray-100">{appointments.length}</span> total
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
      ) : appointments.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-16 text-center">
          <div className="w-12 h-12 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">No appointments scheduled</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">Nothing booked for this day yet.</p>
          <button onClick={() => setShowNewModal(true)} className="btn-primary text-sm">+ New Appointment</button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
          {appointments.map((appointment) => (
            <AppointmentRow key={appointment.id} appointment={appointment} />
          ))}
        </div>
      )}

      {showNewModal && (
        <NewAppointmentModal onClose={() => setShowNewModal(false)} selectedDate={selectedDate} />
      )}
    </div>
  );
}

function AppointmentRow({ appointment }: { appointment: Appointment }) {
  const queryClient = useQueryClient();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
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
    onError: (e: any) => alert(e.message || 'Failed to cancel'),
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
    onError: (e: any) => alert(e.message || 'Failed to confirm'),
  });

  const canConfirm = appointment.status === 'pending';
  const canModify = ['pending', 'scheduled', 'confirmed'].includes(appointment.status);

  return (
    <>
      <div className="flex items-center gap-0 hover:bg-gray-50/60 dark:hover:bg-gray-700/60 transition-colors group">
        {/* Status bar */}
        <div className={`w-1 self-stretch flex-shrink-0 ${config.bar}`} />

        {/* Time */}
        <div className="w-28 flex-shrink-0 px-4 py-4">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">
            {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 tabular-nums mt-0.5">
            {endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
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
            {appointment.notes && (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-1 truncate max-w-xs">{appointment.notes}</p>
            )}
          </div>
        </div>

        {/* Status + Actions */}
        <div className="flex items-center gap-2 px-4 py-4 flex-shrink-0">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${config.badge}`}>
            {config.label}
          </span>

          {canConfirm ? (
            <div className="flex gap-1.5 ml-2">
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
            <div className="flex gap-1.5 ml-2">
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
            <div className="w-[100px] ml-2" />
          )}
        </div>
      </div>

      {showEditModal && <EditAppointmentModal appointment={appointment} onClose={() => setShowEditModal(false)} />}

      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Cancel appointment?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              <strong className="text-gray-700 dark:text-gray-300">{appointment.customer.name}</strong> on{' '}
              {startTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at{' '}
              {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
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
  const [formData, setFormData] = useState({
    customerId: '',
    serviceId: '',
    staffId: '',
    date: selectedDate.toLocaleDateString('en-CA'),
    time: '',
    duration: 60,
    notes: '',
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const res = await fetch('/api/customers');
      if (!res.ok) throw new Error('Failed to fetch customers');
      return res.json();
    },
  });

  const customers = customersData?.customers || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const startTime = new Date(`${formData.date}T${formData.time}`);
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: formData.customerId,
          serviceId: formData.serviceId || null,
          staffId: formData.staffId || null,
          startTime: startTime.toISOString(),
          duration: formData.duration,
          notes: formData.notes || null,
        }),
      });
      if (res.ok) { onClose(); window.location.reload(); }
      else { const error = await res.json(); alert(error.error || 'Failed to create appointment'); }
    } catch { alert('Failed to create appointment'); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 dark:border-gray-700">
        <div className="p-6">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New Appointment</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Customer *</label>
              <select value={formData.customerId} onChange={(e) => setFormData({ ...formData, customerId: e.target.value })} className="input" required>
                <option value="">Select a customer</option>
                {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
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
              <label className="label">Notes</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="input" rows={3} placeholder="Any special requests or notes…" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 btn-outline">Cancel</button>
              <button type="submit" className="flex-1 btn-primary">Create Appointment</button>
            </div>
          </form>
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
    onError: (e: any) => alert(e.message || 'Failed to update appointment'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newStart = new Date(`${formData.date}T${formData.time}`);
    const newEnd = new Date(newStart.getTime() + formData.duration * 60000);
    updateMutation.mutate({ startTime: newStart.toISOString(), endTime: newEnd.toISOString(), duration: formData.duration, notes: formData.notes || null, status: formData.status });
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
