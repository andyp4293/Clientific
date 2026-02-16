'use client';

import { useState, useRef, useEffect } from 'react';

interface TimePickerProps {
  value: string; // "HH:MM" format (24-hour)
  onChange: (time: string) => void;
  label?: string;
}

// Convert 24-hour to 12-hour format
function to12Hour(hour24: number): { hour12: number; period: 'AM' | 'PM' } {
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  return { hour12, period };
}

// Convert 12-hour to 24-hour format
function to24Hour(hour12: number, period: 'AM' | 'PM'): number {
  if (period === 'AM') {
    return hour12 === 12 ? 0 : hour12;
  } else {
    return hour12 === 12 ? 12 : hour12 + 12;
  }
}

export function TimePicker({ value, onChange, label }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hours24, setHours24] = useState(parseInt(value.split(':')[0]));
  const [minutes, setMinutes] = useState(parseInt(value.split(':')[1]));
  const containerRef = useRef<HTMLDivElement>(null);

  const { hour12, period } = to12Hour(hours24);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  useEffect(() => {
    setHours24(parseInt(value.split(':')[0]));
    setMinutes(parseInt(value.split(':')[1]));
  }, [value]);

  const handleHoursChange = (newHours24: number) => {
    const clamped = Math.max(0, Math.min(23, newHours24));
    setHours24(clamped);
    onChange(`${String(clamped).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
  };

  const handlePeriodToggle = () => {
    const newHours24 = period === 'AM' ? hours24 + 12 : hours24 - 12;
    handleHoursChange(newHours24);
  };

  const handleMinutesChange = (newMinutes: number) => {
    const clamped = Math.max(0, Math.min(59, newMinutes));
    setMinutes(clamped);
    onChange(`${String(hours24).padStart(2, '0')}:${String(clamped).padStart(2, '0')}`);
  };

  const handleInputChange = (type: 'hours' | 'minutes', val: string) => {
    if (type === 'hours') {
      const num = parseInt(val) || 12;
      const newHours24 = to24Hour(Math.max(1, Math.min(12, num)), period);
      handleHoursChange(newHours24);
    } else {
      const num = parseInt(val) || 0;
      handleMinutesChange(num);
    }
  };

  const displayTime = `${String(hour12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-left font-medium text-gray-900 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all flex items-center justify-between"
      >
        <span>{displayTime}</span>
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 z-50 p-4 w-64">
          <div className="space-y-4">
            {/* Hours with AM/PM toggle */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Time</label>
              <div className="flex items-center gap-2">
                {/* Hours */}
                <div className="flex items-center gap-1 flex-1">
                  <button
                    onClick={() => {
                      const newHour12 = hour12 === 1 ? 12 : hour12 - 1;
                      handleHoursChange(to24Hour(newHour12, period));
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={String(hour12).padStart(2, '0')}
                    onChange={(e) => handleInputChange('hours', e.target.value)}
                    className="flex-1 text-center px-2 py-2 border border-gray-300 rounded-lg font-semibold text-lg w-16"
                  />
                  <button
                    onClick={() => {
                      const newHour12 = hour12 === 12 ? 1 : hour12 + 1;
                      handleHoursChange(to24Hour(newHour12, period));
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                <span className="text-2xl font-bold text-gray-400">:</span>

                {/* Minutes */}
                <div className="flex items-center gap-1 flex-1">
                  <button
                    onClick={() => handleMinutesChange(minutes - 15)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={String(minutes).padStart(2, '0')}
                    onChange={(e) => handleInputChange('minutes', e.target.value)}
                    className="flex-1 text-center px-2 py-2 border border-gray-300 rounded-lg font-semibold text-lg w-16"
                  />
                  <button
                    onClick={() => handleMinutesChange(minutes + 15)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* AM/PM Toggle */}
                <button
                  onClick={handlePeriodToggle}
                  className="px-3 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  {period}
                </button>
              </div>
            </div>            {/* Quick presets */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Quick Set</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '12 AM', value: '00:00' },
                  { label: '9 AM', value: '09:00' },
                  { label: '12 PM', value: '12:00' },
                  { label: '5 PM', value: '17:00' },
                  { label: '6 PM', value: '18:00' },
                  { label: '11 PM', value: '23:00' },
                ].map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => {
                      const [h, m] = preset.value.split(':').map(Number);
                      setHours24(h);
                      setMinutes(m);
                      onChange(preset.value);
                    }}
                    className="px-2 py-2 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="w-full py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
