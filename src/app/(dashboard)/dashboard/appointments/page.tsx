'use client';

import { useState, useEffect } from 'react';
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

  // Fetch appointments for selected date
  const { data, isLoading } = useQuery({
    queryKey: ['appointments', selectedDate.toISOString().split('T')[0]],
    queryFn: async () => {
      const res = await fetch(`/api/appointments?date=${selectedDate.toISOString().split('T')[0]}`);
      if (!res.ok) throw new Error('Failed to fetch appointments');
      return res.json();
    },
  });

  const appointments: Appointment[] = data?.appointments || [];

  return (
    <div className="max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Appointments</h1>
        <button onClick={() => setShowNewModal(true)} className="btn-primary">
          + New Appointment
        </button>
      </div>

      {/* Date Navigator */}
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                const newDate = new Date(selectedDate);
                newDate.setDate(newDate.getDate() - 1);
                setSelectedDate(newDate);
              }}
              className="btn-outline p-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div className="text-center">
              <h2 className="text-xl font-semibold">
                {selectedDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h2>
            </div>

            <button
              onClick={() => {
                const newDate = new Date(selectedDate);
                newDate.setDate(newDate.getDate() + 1);
                setSelectedDate(newDate);
              }}
              className="btn-outline p-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button
              onClick={() => setSelectedDate(new Date())}
              className="btn-outline"
            >
              Today
            </button>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={() => setView('day')}
              className={`px-3 py-1 rounded ${view === 'day' ? 'bg-primary text-white' : 'bg-gray-100'}`}
            >
              Day
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-3 py-1 rounded ${view === 'week' ? 'bg-primary text-white' : 'bg-gray-100'}`}
            >
              Week
            </button>
            <button
              onClick={() => setView('month')}
              className={`px-3 py-1 rounded ${view === 'month' ? 'bg-primary text-white' : 'bg-gray-100'}`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Appointments List */}
      {isLoading ? (
        <div className="card p-8 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading appointments...</p>
        </div>
      ) : appointments.length === 0 ? (
        <div className="card p-8 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No appointments scheduled</h3>
          <p className="text-gray-600 mb-4">Get started by creating a new appointment.</p>
          <button onClick={() => setShowNewModal(true)} className="btn-primary">
            + Create Appointment
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appointment) => (
            <AppointmentCard key={appointment.id} appointment={appointment} />
          ))}
        </div>
      )}

      {/* New Appointment Modal */}
      {showNewModal && (
        <NewAppointmentModal
          onClose={() => setShowNewModal(false)}
          selectedDate={selectedDate}
        />
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

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    scheduled: 'bg-blue-100 text-blue-800',
    confirmed: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
    no_show: 'bg-orange-100 text-orange-800',
  };

  // Cancel appointment mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to cancel appointment');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setShowCancelConfirm(false);
    },
    onError: (error: any) => {
      alert(error.message || 'Failed to cancel appointment');
    },
  });

  // Confirm appointment mutation
  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to confirm appointment');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (error: any) => {
      alert(error.message || 'Failed to confirm appointment');
    },
  });

  const canConfirm = appointment.status === 'pending';
  // Check if appointment can be edited/cancelled (pending/scheduled/confirmed)
  const canModify = ['pending', 'scheduled', 'confirmed'].includes(appointment.status);

  return (
    <>
      <div className="card p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className="text-center min-w-[80px]">
              <div className="text-2xl font-bold text-primary">
                {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </div>
              <div className="text-sm text-gray-600">
                {appointment.duration} min
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="font-semibold text-lg">{appointment.customer.name}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[appointment.status as keyof typeof statusColors] || statusColors.scheduled}`}>
                  {appointment.status}
                </span>
              </div>

              {appointment.service && (
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-medium">Service:</span> {appointment.service.name}
                </p>
              )}

              {appointment.staff && (
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-medium">Staff:</span> {appointment.staff.fullName}
                </p>
              )}

              {appointment.customer.phone && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Phone:</span> {appointment.customer.phone}
                </p>
              )}

              {appointment.notes && (
                <p className="text-sm text-gray-600 mt-2 italic">
                  {appointment.notes}
                </p>
              )}
            </div>
          </div>

          {canConfirm ? (
            <div className="flex space-x-2">
              <button
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
                className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {confirmMutation.isPending ? 'Confirming...' : 'Confirm'}
              </button>
              <button
                onClick={() => setShowCancelConfirm(true)}
                disabled={cancelMutation.isPending}
                className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-200 disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          ) : canModify && (
            <div className="flex space-x-2">
              <button
                onClick={() => setShowEditModal(true)}
                className="btn-outline btn-sm"
              >
                Edit
              </button>
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="btn-outline btn-sm text-red-600 hover:bg-red-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditAppointmentModal
          appointment={appointment}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Cancel Appointment?</h3>
            <p className="text-gray-600 mb-2">
              Are you sure you want to cancel this appointment with <strong>{appointment.customer.name}</strong>?
            </p>
            <p className="text-sm text-gray-500 mb-6">
              {startTime.toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="btn-outline"
                disabled={cancelMutation.isPending}
              >
                Keep Appointment
              </button>
              <button
                onClick={() => cancelMutation.mutate()}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Yes, Cancel'}
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

  // Fetch customers, services, staff
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

      if (res.ok) {
        onClose();
        window.location.reload();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create appointment');
      }
    } catch (error) {
      console.error('Create appointment error:', error);
      alert('Failed to create appointment');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">New Appointment</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Customer *</label>
              <select
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                className="input"
                required
              >
                <option value="">Select a customer</option>
                {customers.map((customer: any) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">Time *</label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="input"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Duration (minutes) *</label>
              <select
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                className="input"
                required
              >
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
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input"
                rows={3}
                placeholder="Any special requests or notes..."
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={onClose} className="btn-outline">
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Create Appointment
              </button>
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

  // Update appointment mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update appointment');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      onClose();
    },
    onError: (error: any) => {
      alert(error.message || 'Failed to update appointment');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newStartTime = new Date(`${formData.date}T${formData.time}`);
    const newEndTime = new Date(newStartTime.getTime() + formData.duration * 60000);

    updateMutation.mutate({
      startTime: newStartTime.toISOString(),
      endTime: newEndTime.toISOString(),
      duration: formData.duration,
      notes: formData.notes || null,
      status: formData.status,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Edit Appointment</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Customer Info (Read-only) */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-2">Customer</h3>
            <p className="text-lg">{appointment.customer.name}</p>
            {appointment.customer.phone && (
              <p className="text-sm text-gray-600">{appointment.customer.phone}</p>
            )}
            {appointment.service && (
              <p className="text-sm text-gray-600 mt-2">
                <span className="font-medium">Service:</span> {appointment.service.name}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">Time *</label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="input"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Duration (minutes) *</label>
              <select
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                className="input"
                required
              >
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
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="input"
              >
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
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input"
                rows={3}
                placeholder="Any special requests or notes..."
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button 
                type="button" 
                onClick={onClose} 
                className="btn-outline"
                disabled={updateMutation.isPending}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-primary"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

