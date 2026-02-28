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

export default function AppointmentsPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [showNewModal, setShowNewModal] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', selectedDate.toISOString().split('T')[0]],
    queryFn: async () => {
      const res = await fetch(`/api/appointments?date=${selectedDate.toISOString().split('T')[0]}`);
      if (!res.ok) throw new Error('Failed to fetch appointments');
      return res.json();
    },
  });

  const appointments: Appointment[] = data?.appointments || [];

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isToday ? 'Today' : selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            {appointments.length > 0 && ` · ${appointments.length} appointment${appointments.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={() => setShowNewModal(true)} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Appointment
        </button>
      </div>

      {/* Date Navigator */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - 1);
                setSelectedDate(d);
              }}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="px-3 text-center">
              <p className="text-sm font-semibold text-gray-900">
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-xs text-gray-400">{selectedDate.getFullYear()}</p>
            </div>

            <button
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() + 1);
                setSelectedDate(d);
              }}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {!isToday && (
              <button
                onClick={() => setSelectedDate(new Date())}
                className="ml-1 text-xs font-medium text-primary px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
              >
                Today
              </button>
            )}
          </div>

          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  view === v ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Appointments List */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading appointments…</p>
        </div>
      ) : appointments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No appointments</h3>
          <p className="text-sm text-gray-400 mb-5">Nothing scheduled for this day.</p>
          <button onClick={() => setShowNewModal(true)} className="btn-primary">
            + New Appointment
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appointment) => (
            <AppointmentCard key={appointment.id} appointment={appointment} />
          ))}
        </div>
      )}

      {showNewModal && (
        <NewAppointmentModal onClose={() => setShowNewModal(false)} selectedDate={selectedDate} />
      )}
    </div>
  );
}

function AppointmentCard({ appointment }: { appointment: Appointment }) {
  const queryClient = useQueryClient();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const startTime = new Date(appointment.startTime);
  const endTime = new Date(appointment.endTime);

  const statusConfig: Record<string, { badge: string; bar: string; label: string }> = {
    pending:   { badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',   bar: 'bg-amber-400',  label: 'Pending' },
    scheduled: { badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',      bar: 'bg-blue-500',   label: 'Scheduled' },
    confirmed: { badge: 'bg-green-50 text-green-700 ring-1 ring-green-200',   bar: 'bg-green-500',  label: 'Confirmed' },
    completed: { badge: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',     bar: 'bg-gray-400',   label: 'Completed' },
    cancelled: { badge: 'bg-red-50 text-red-600 ring-1 ring-red-200',         bar: 'bg-red-400',    label: 'Cancelled' },
    no_show:   { badge: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',bar: 'bg-orange-400', label: 'No Show' },
  };
  const config = statusConfig[appointment.status] ?? statusConfig.scheduled;

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
    onError: (e: any) => alert(e.message || 'Failed to cancel appointment'),
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
    onError: (e: any) => alert(e.message || 'Failed to confirm appointment'),
  });

  const canConfirm = appointment.status === 'pending';
  const canModify = ['pending', 'scheduled', 'confirmed'].includes(appointment.status);

  const initials = appointment.customer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
        <div className="flex">
          {/* Status bar */}
          <div className={`w-1 flex-shrink-0 ${config.bar}`} />

          <div className="flex-1 p-4 flex items-start gap-4">
            {/* Time */}
            <div className="flex-shrink-0 w-20 text-center pt-0.5">
              <p className="text-base font-bold text-gray-900 leading-tight">
                {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </p>
              <p className="text-xs text-gray-400">{appointment.duration} min</p>
            </div>

            {/* Divider */}
            <div className="w-px bg-gray-100 self-stretch flex-shrink-0" />

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-primary">{initials}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{appointment.customer.name}</p>
                </div>
                <span className={`ml-auto flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${config.badge}`}>
                  {config.label}
                </span>
              </div>

              <div className="space-y-1">
                {appointment.service && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {appointment.service.name}
                  </div>
                )}
                {appointment.staff && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {appointment.staff.fullName}
                  </div>
                )}
                {appointment.customer.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {appointment.customer.phone}
                  </div>
                )}
                {appointment.notes && (
                  <p className="text-xs text-gray-400 italic mt-1.5 bg-gray-50 rounded-md px-2.5 py-1.5">
                    {appointment.notes}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex-shrink-0 flex flex-col gap-2">
              {canConfirm ? (
                <>
                  <button
                    onClick={() => confirmMutation.mutate()}
                    disabled={confirmMutation.isPending}
                    className="text-xs font-medium px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {confirmMutation.isPending ? '…' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={cancelMutation.isPending}
                    className="text-xs font-medium px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    Decline
                  </button>
                </>
              ) : canModify && (
                <>
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="text-xs font-medium px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="text-xs font-medium px-3 py-1.5 border border-gray-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {showEditModal && (
        <EditAppointmentModal appointment={appointment} onClose={() => setShowEditModal(false)} />
      )}

      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Cancel appointment?</h3>
            <p className="text-sm text-gray-600 mb-1">
              This will cancel <strong>{appointment.customer.name}</strong>&apos;s appointment.
            </p>
            <p className="text-xs text-gray-400 mb-5">
              {startTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at{' '}
              {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancelMutation.isPending}
                className="flex-1 btn-outline text-sm"
              >
                Keep
              </button>
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="flex-1 bg-red-600 text-white text-sm rounded-lg px-4 py-2 hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {cancelMutation.isPending ? 'Cancelling…' : 'Yes, Cancel'}
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
    date: selectedDate.toISOString().split('T')[0],
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-semibold text-gray-900">New Appointment</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    date: startTime.toISOString().split('T')[0],
    time: startTime.toTimeString().slice(0, 5),
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-semibold text-gray-900">Edit Appointment</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 mb-5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold text-primary">
                {appointment.customer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{appointment.customer.name}</p>
              {appointment.customer.phone && <p className="text-xs text-gray-500">{appointment.customer.phone}</p>}
              {appointment.service && <p className="text-xs text-gray-500">{appointment.service.name}</p>}
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
