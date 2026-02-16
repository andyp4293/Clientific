'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TimePicker } from '@/components/ui/TimePicker';

interface BusinessHour {
  id: string;
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function BusinessHoursPage() {
  const queryClient = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);
  const [localHours, setLocalHours] = useState<BusinessHour[]>([]);
  const [timezone, setTimezone] = useState<string>('');

  // Fetch business hours
  const { data, isLoading } = useQuery<{ businessHours: BusinessHour[] }>({
    queryKey: ['business-hours'],
    queryFn: async () => {
      const res = await fetch('/api/business-hours');
      if (!res.ok) throw new Error('Failed to fetch business hours');
      return res.json();
    },
  });

  // Fetch business info for timezone
  const { data: businessData } = useQuery({
    queryKey: ['business-info'],
    queryFn: async () => {
      const res = await fetch('/api/business');
      if (!res.ok) throw new Error('Failed to fetch business info');
      return res.json();
    },
  });

  // Update timezone when business data loads
  useEffect(() => {
    if (businessData?.business?.timezone) {
      setTimezone(businessData.business.timezone);
    }
  }, [businessData]);
  // Update local hours when data loads
  useEffect(() => {
    if (data?.businessHours && localHours.length === 0) {
      // Only set local hours if actual data exists (not empty array)
      if (data.businessHours.length > 0) {
        setLocalHours(data.businessHours);
      }
    }
  }, [data, localHours.length]);

  const businessHours: BusinessHour[] = data?.businessHours || [];
  const hasNoSavedHours = businessHours.length === 0;

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (hours: BusinessHour[]) => {
      const res = await fetch('/api/business-hours', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update business hours');
      }
      return res.json();    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-hours'] });
      setHasChanges(false);
    },
  });

  const handleToggleDay = (dayIndex: number) => {
    const updatedHours = localHours.map((hour) =>
      hour.dayOfWeek === dayIndex
        ? { 
            ...hour, 
            isOpen: !hour.isOpen,
            openTime: !hour.isOpen && !hour.openTime ? '09:00' : hour.openTime,
            closeTime: !hour.isOpen && !hour.closeTime ? '17:00' : hour.closeTime,
          }
        : hour
    );
    setLocalHours(updatedHours);
    setHasChanges(true);
  };

  const handleTimeChange = (dayIndex: number, field: 'openTime' | 'closeTime', value: string) => {
    const updatedHours = localHours.map((hour) =>
      hour.dayOfWeek === dayIndex ? { ...hour, [field]: value } : hour
    );
    setLocalHours(updatedHours);
    setHasChanges(true);  };

  const handleSave = () => {
    updateMutation.mutate(localHours);
  };

  const handleReset = () => {
    setLocalHours(businessHours);
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Business Hours</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
          <p className="text-gray-600">
            Set your operating hours for online bookings
          </p>
          {timezone && (
            <div className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-gray-500 mr-1">Timezone:</span>
              {timezone.replace(/_/g, ' ')}
            </div>          )}
        </div>
      </div>      {/* Timezone Info Banner */}
      {timezone && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm text-blue-900 font-medium">All times are shown in your business timezone</p>
            <p className="text-sm text-blue-700 mt-1">
              Your timezone is set to <span className="font-semibold">{timezone.replace(/_/g, ' ')}</span>. 
              You can change this in <a href="/dashboard/settings" className="underline hover:text-blue-800">Settings</a> if needed.
            </p>
          </div>
        </div>
      )}

      {/* Warning Banner for No Saved Hours */}
      {hasNoSavedHours && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm text-amber-900 font-medium">⚠️ No business hours configured</p>
            <p className="text-sm text-amber-700 mt-1">
              Your online booking is currently unavailable. Set your hours below and click "Save Changes" to enable bookings.
            </p>
          </div>
        </div>
      )}

      {/* Business Hours Card */}
      <div className="card">{localHours.length === 0 ? (
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Business Hours Set</h3>
            <p className="text-gray-600 mb-4">Set up your weekly schedule to enable online bookings</p>
            <button
              onClick={() => {
                // Initialize default hours (Monday-Friday 9 AM - 5 PM)
                const defaultHours = DAYS.map((_, index) => ({
                  id: `temp-${index}`,
                  dayOfWeek: index,
                  isOpen: index >= 1 && index <= 5, // Monday to Friday
                  openTime: '09:00',
                  closeTime: '17:00',
                }));
                setLocalHours(defaultHours);
                setHasChanges(true);
              }}
              className="btn-primary"
            >
              Set Up Business Hours
            </button>
          </div>
        ) : (
        <div className="divide-y divide-gray-200">{localHours.map((hour) => {
            const dayName = DAYS[hour.dayOfWeek];
            return (
              <div key={hour.dayOfWeek} className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Day Toggle */}
                  <div className="flex items-center flex-1 min-w-0">
                    <input
                      type="checkbox"
                      id={`day-${hour.dayOfWeek}`}
                      checked={hour.isOpen}
                      onChange={() => handleToggleDay(hour.dayOfWeek)}
                      className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary mr-3"
                    />
                    <label
                      htmlFor={`day-${hour.dayOfWeek}`}
                      className={`text-base font-medium cursor-pointer select-none ${
                        hour.isOpen ? 'text-gray-900' : 'text-gray-400'
                      }`}
                    >
                      {dayName}
                    </label>
                  </div>                  {/* Time Inputs */}
                  {hour.isOpen ? (
                    <div className="flex items-center gap-3 sm:ml-auto flex-col sm:flex-row w-full sm:w-auto">
                      <div className="w-full sm:w-32">
                        <TimePicker
                          value={hour.openTime || '09:00'}
                          onChange={(time) => handleTimeChange(hour.dayOfWeek, 'openTime', time)}
                        />
                      </div>
                      <span className="text-gray-500 hidden sm:inline">to</span>
                      <div className="w-full sm:w-32">
                        <TimePicker
                          value={hour.closeTime || '17:00'}
                          onChange={(time) => handleTimeChange(hour.dayOfWeek, 'closeTime', time)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm sm:ml-auto">Closed</div>
                  )}
                </div>
              </div>            );
          })}
        </div>
        )}
      </div>

      {/* Quick Actions */}
      {localHours.length > 0 && (
      <div className="card p-4 sm:p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              const weekdayHours = localHours.map((hour) => ({
                ...hour,
                isOpen: hour.dayOfWeek >= 1 && hour.dayOfWeek <= 5,
                openTime: hour.dayOfWeek >= 1 && hour.dayOfWeek <= 5 ? '09:00' : null,
                closeTime: hour.dayOfWeek >= 1 && hour.dayOfWeek <= 5 ? '17:00' : null,
              }));
              setLocalHours(weekdayHours);
              setHasChanges(true);
            }}
            className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Mon-Fri 9-5
          </button>
          <button
            onClick={() => {
              const allDayHours = localHours.map((hour) => ({
                ...hour,
                isOpen: true,
                openTime: '00:00',
                closeTime: '23:59',
              }));
              setLocalHours(allDayHours);
              setHasChanges(true);
            }}
            className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            24/7
          </button>
          <button
            onClick={() => {
              const closedHours = localHours.map((hour) => ({
                ...hour,
                isOpen: false,
                openTime: null,
                closeTime: null,
              }));
              setLocalHours(closedHours);
              setHasChanges(true);
            }}
            className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close All
          </button>        </div>
      </div>
      )}

      {/* Error Message */}
      {updateMutation.isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">
            {updateMutation.error?.message || 'Failed to update business hours'}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      {localHours.length > 0 && (
      <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">{hasNoSavedHours && (
          <div className="text-sm text-amber-600 flex items-center gap-2 mr-auto">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium">Click "Save Changes" to enable online bookings</span>
          </div>
        )}
        <button
          onClick={handleReset}
          disabled={!hasChanges || updateMutation.isPending}
          className="px-6 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges || updateMutation.isPending}
          className={`px-6 py-2.5 ${hasNoSavedHours ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:bg-primary-600'} text-white font-medium rounded-lg transition-colors shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {updateMutation.isPending ? (
            <span className="inline-flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </span>
          ) : (
            'Save Changes'          )}
        </button>
      </div>
      )}
    </div>
  );
}
