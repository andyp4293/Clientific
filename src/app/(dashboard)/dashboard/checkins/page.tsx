'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@/components/ui/DatePicker';
import { CustomSelect } from '@/components/ui/CustomSelect';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
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

  const formatDateLocal = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;

  const { data: checkInsData, isLoading: isLoadingCheckIns } = useQuery({
    queryKey: ['checkins', formatDateLocal(selectedDate)],
    queryFn: async () => {
      const res = await fetch(`/api/checkins?date=${formatDateLocal(selectedDate)}`);
      if (!res.ok) throw new Error('Failed to fetch check-ins');
      return res.json();
    },
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers', searchTerm],
    queryFn: async () => {
      const res = await fetch(`/api/customers?search=${searchTerm}`);
      if (!res.ok) throw new Error('Failed to fetch customers');
      return res.json();
    },
    enabled: showModal && searchTerm.length >= 2,
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await fetch('/api/services');
      if (!res.ok) throw new Error('Failed to fetch services');
      return res.json();
    },
    enabled: showModal,
  });

  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const res = await fetch('/api/staff');
      if (!res.ok) throw new Error('Failed to fetch staff');
      return res.json();
    },
    enabled: showModal,
  });

  const createCheckIn = useMutation({
    mutationFn: async (data: {
      customerId: string;
      serviceId?: string;
      staffId?: string;
      amountSpent?: number;
    }) => {
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
  const timezone: string = checkInsData?.timezone || 'America/New_York';
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
  const averageTicket = checkIns.length > 0 ? totalSpent / checkIns.length : 0;

  return (
    <div data-testid="checkins-page" className="w-full space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
            Check-Ins
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 sm:text-base">
            Track customer visits, services, staff coverage, and in-person revenue
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary w-full text-sm sm:w-auto">
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Check-In
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-4 sm:p-6">
          <p className="mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">Today's Check-Ins</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
            {checkIns.length}
          </p>
        </div>
        <div className="card p-4 sm:p-6">
          <p className="mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">Revenue</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
            ${totalSpent.toFixed(2)}
          </p>
        </div>
        <div className="card p-4 sm:p-6">
          <p className="mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">Average Ticket</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
            ${averageTicket.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="card p-4 sm:p-6">
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Filter by Date
        </label>
        <DatePicker value={selectedDate} onChange={setSelectedDate} />
      </div>

      <div className="card">
        <div className="border-b border-gray-200 p-4 dark:border-gray-700 sm:p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 sm:text-lg">
            Check-Ins for{' '}
            {selectedDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </h2>
        </div>

        {isLoadingCheckIns ? (
          <div className="p-8 text-center sm:p-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : checkIns.length === 0 ? (
          <div className="p-8 text-center sm:p-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="mt-4 text-gray-600 dark:text-gray-400">No check-ins for this date</p>
            <button onClick={() => setShowModal(true)} className="btn-primary mt-4">
              Create First Check-In
            </button>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-200 dark:divide-gray-700 sm:hidden">
              {checkIns.map((checkIn) => (
                <div key={checkIn.id} className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {new Date(checkIn.checkInTime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZone: timezone,
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {checkIn.customer.name}
                    </p>
                    {checkIn.customer.phone && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {checkIn.customer.phone}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <p>
                      Service:{' '}
                      <span className="text-gray-900 dark:text-gray-100">
                        {checkIn.service?.name || '-'}
                      </span>
                    </p>
                    <p>
                      Staff:{' '}
                      <span className="text-gray-900 dark:text-gray-100">
                        {checkIn.staff?.fullName || '-'}
                      </span>
                    </p>
                    <p className="col-span-2">
                      Amount:{' '}
                      <span className="text-gray-900 dark:text-gray-100">
                        {checkIn.amountSpent ? `$${checkIn.amountSpent.toFixed(2)}` : '-'}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Service
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Staff
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                  {checkIns.map((checkIn) => (
                    <tr key={checkIn.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        {new Date(checkIn.checkInTime).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          timeZone: timezone,
                        })}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {checkIn.customer.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {checkIn.customer.phone}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        {checkIn.service?.name || '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        {checkIn.staff?.fullName || '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        {checkIn.amountSpent ? `$${checkIn.amountSpent.toFixed(2)}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showModal && (
        <div data-mobile-overlay="true" className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 dark:bg-gray-800 sm:max-h-[90vh] sm:rounded-2xl sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 sm:text-xl">
                New Check-In
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setFormData({ customerId: '', serviceId: '', staffId: '', amountSpent: '' });
                  setSearchTerm('');
                }}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Customer <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input"
                />
                {searchTerm.length >= 2 && customers.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-700">
                    {customers.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, customerId: customer.id });
                          setSearchTerm(customer.name);
                        }}
                        className="w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-600 last:border-0"
                      >
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {customer.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {customer.phone || customer.email || 'No contact info'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Service (Optional)
                </label>
                <CustomSelect
                  value={formData.serviceId}
                  onChange={(serviceId) => {
                    setFormData({ ...formData, serviceId });
                    const service = services.find((item) => item.id === serviceId);
                    if (service?.price && service.price > 0) {
                      setFormData((prev) => ({
                        ...prev,
                        serviceId,
                        amountSpent: service.price!.toString(),
                      }));
                    }
                  }}
                  placeholder="No service"
                  options={services.map((service) => ({
                    value: service.id,
                    label: service.name + (service.price ? ` - $${service.price.toFixed(2)}` : ''),
                  }))}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Staff (Optional)
                </label>
                <CustomSelect
                  value={formData.staffId}
                  onChange={(value) => setFormData({ ...formData, staffId: value })}
                  placeholder="No staff"
                  options={staff.map((member) => ({ value: member.id, label: member.fullName }))}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Amount Spent (Optional)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-gray-500 dark:text-gray-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amountSpent}
                    onChange={(e) => setFormData({ ...formData, amountSpent: e.target.value })}
                    className="input pl-8"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {createCheckIn.isError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                  <p className="text-sm text-red-800 dark:text-red-400">
                    {createCheckIn.error instanceof Error
                      ? createCheckIn.error.message
                      : 'Failed to create check-in'}
                  </p>
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setFormData({ customerId: '', serviceId: '', staffId: '', amountSpent: '' });
                    setSearchTerm('');
                  }}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formData.customerId || createCheckIn.isPending}
                  className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
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
