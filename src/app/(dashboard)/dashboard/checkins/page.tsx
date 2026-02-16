'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@/components/ui/DatePicker';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  points: number;
}

interface Service {
  id: string;
  name: string;
  price: number | null;
}

interface Staff {
  id: string;
  fullName: string;
}

interface CheckIn {
  id: string;
  checkInTime: string;
  amountSpent: number | null;
  pointsEarned: number;
  customer: Customer;
  service: Service | null;
  staff: Staff | null;
}

export default function CheckInsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    customerId: '',
    serviceId: '',
    staffId: '',
    amountSpent: '',
  });

  // Fetch check-ins for selected date
  const { data: checkInsData, isLoading: isLoadingCheckIns } = useQuery({
    queryKey: ['checkins', selectedDate.toISOString().split('T')[0]],
    queryFn: async () => {
      const res = await fetch(`/api/checkins?date=${selectedDate.toISOString().split('T')[0]}`);
      if (!res.ok) throw new Error('Failed to fetch check-ins');
      return res.json();
    },
  });

  // Fetch customers for search
  const { data: customersData } = useQuery({
    queryKey: ['customers', searchTerm],
    queryFn: async () => {
      const res = await fetch(`/api/customers?search=${searchTerm}`);
      if (!res.ok) throw new Error('Failed to fetch customers');
      return res.json();
    },
    enabled: showModal && searchTerm.length >= 2,
  });

  // Fetch services
  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await fetch('/api/services');
      if (!res.ok) throw new Error('Failed to fetch services');
      return res.json();
    },
    enabled: showModal,
  });

  // Fetch staff
  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const res = await fetch('/api/staff');
      if (!res.ok) throw new Error('Failed to fetch staff');
      return res.json();
    },
    enabled: showModal,
  });

  // Create check-in mutation
  const createCheckIn = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create check-in');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkins'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowModal(false);
      setFormData({ customerId: '', serviceId: '', staffId: '', amountSpent: '' });
      setSearchTerm('');
    },
  });

  const checkIns: CheckIn[] = checkInsData?.checkIns || [];
  const customers: Customer[] = customersData?.customers || [];
  const services: Service[] = servicesData?.services || [];
  const staff: Staff[] = staffData?.staff || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId) return;

    createCheckIn.mutate({
      customerId: formData.customerId,
      serviceId: formData.serviceId || undefined,
      staffId: formData.staffId || undefined,
      amountSpent: formData.amountSpent ? parseFloat(formData.amountSpent) : undefined,
    });
  };

  const totalSpent = checkIns.reduce((sum, ci) => sum + (ci.amountSpent || 0), 0);
  const totalPoints = checkIns.reduce((sum, ci) => sum + ci.pointsEarned, 0);

  return (
    <div className="max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Check-Ins</h1>
          <p className="text-gray-600 mt-1">Track customer visits and award loyalty points</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Check-In
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6">
          <p className="text-sm font-medium text-gray-600 mb-1">Today's Check-Ins</p>
          <p className="text-3xl font-bold text-gray-900">{checkIns.length}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm font-medium text-gray-600 mb-1">Revenue</p>
          <p className="text-3xl font-bold text-gray-900">${totalSpent.toFixed(2)}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm font-medium text-gray-600 mb-1">Points Awarded</p>
          <p className="text-3xl font-bold text-gray-900">{totalPoints}</p>
        </div>
      </div>

      {/* Date Filter */}
      <div className="card p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Date</label>
        <DatePicker value={selectedDate} onChange={setSelectedDate} />
      </div>

      {/* Check-Ins List */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            Check-Ins for {selectedDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric', 
              year: 'numeric' 
            })}
          </h2>
        </div>

        {isLoadingCheckIns ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : checkIns.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="mt-4 text-gray-600">No check-ins for this date</p>
            <button onClick={() => setShowModal(true)} className="mt-4 btn-primary">
              Create First Check-In
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {checkIns.map((checkIn) => (
                  <tr key={checkIn.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(checkIn.checkInTime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{checkIn.customer.name}</div>
                      <div className="text-sm text-gray-500">{checkIn.customer.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {checkIn.service?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {checkIn.staff?.fullName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {checkIn.amountSpent ? `$${checkIn.amountSpent.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        +{checkIn.pointsEarned} pts
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Check-In Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">New Check-In</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setFormData({ customerId: '', serviceId: '', staffId: '', amountSpent: '' });
                  setSearchTerm('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Customer Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchTerm.length >= 2 && customers.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-xl max-h-48 overflow-y-auto">
                    {customers.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, customerId: customer.id });
                          setSearchTerm(customer.name);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        <div className="font-medium text-gray-900">{customer.name}</div>
                        <div className="text-sm text-gray-500">
                          {customer.phone} • {customer.points} points
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Service */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Service (Optional)</label>
                <select
                  value={formData.serviceId}                  onChange={(e) => {
                    const serviceId = e.target.value;
                    setFormData({ ...formData, serviceId });
                    // Auto-fill amount if service has a price
                    const service = services.find(s => s.id === serviceId);
                    if (service?.price && service.price > 0) {
                      setFormData(prev => ({ ...prev, serviceId, amountSpent: service.price!.toString() }));
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No service</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} {service.price ? `- $${service.price.toFixed(2)}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Staff */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Staff (Optional)</label>
                <select
                  value={formData.staffId}
                  onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No staff</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.fullName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount Spent */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount Spent (Optional)</label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amountSpent}
                    onChange={(e) => setFormData({ ...formData, amountSpent: e.target.value })}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {createCheckIn.isError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-800">
                    {createCheckIn.error instanceof Error 
                      ? createCheckIn.error.message 
                      : 'Failed to create check-in'}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setFormData({ customerId: '', serviceId: '', staffId: '', amountSpent: '' });
                    setSearchTerm('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formData.customerId || createCheckIn.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createCheckIn.isPending ? 'Creating...' : 'Check In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
