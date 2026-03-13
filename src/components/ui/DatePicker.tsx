'use client';

import { useState, useRef, useEffect } from 'react';

interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  onClear?: () => void;
  allowClear?: boolean;
  minDate?: Date;
  maxDate?: Date;
  placeholder?: string;
}

export function DatePicker({
  value,
  onChange,
  onClear,
  allowClear = false,
  minDate,
  maxDate,
  placeholder = 'Select date',
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(() => {
    const base = value ?? new Date();
    return new Date(base.getFullYear(), base.getMonth());
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value) return;
    setDisplayMonth(new Date(value.getFullYear(), value.getMonth()));
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const handlePrevMonth = () => {
    setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1));
  };

  const handleDateClick = (day: number) => {
    const newDate = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day);
    onChange(newDate);
    setIsOpen(false);
  };
  const isDateDisabled = (day: number | null) => {
    if (!day) return false;
    const date = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day);
    if (minDate) {
      const minDay = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
      if (date < minDay) return true;
    }
    if (maxDate) {
      const maxDay = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
      if (date > maxDay) return true;
    }
    return false;
  };

  const days = [];
  const daysInMonth = getDaysInMonth(displayMonth);
  const firstDay = getFirstDayOfMonth(displayMonth);

  // Empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  // Days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const isSelected = (day: number | null) => {
    if (!day || !value) return false;
    return (
      day === value.getDate() &&
      displayMonth.getMonth() === value.getMonth() &&
      displayMonth.getFullYear() === value.getFullYear()
    );
  };

  const isToday = (day: number | null) => {
    if (!day) return false;
    const today = new Date();
    return (
      day === today.getDate() &&
      displayMonth.getMonth() === today.getMonth() &&
      displayMonth.getFullYear() === today.getFullYear()
    );
  };

  const monthName = displayMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const selectedDateStr = value
    ? value.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : placeholder;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-left font-medium text-gray-900 dark:text-gray-100 bg-white/92 dark:bg-gray-900/82 hover:bg-primary-50 dark:hover:bg-gray-800 focus:ring-2 focus:ring-primary/30 focus:border-transparent transition-all flex items-center justify-between"
      >
        <span className={!value ? 'text-gray-500 dark:text-gray-400' : ''}>{selectedDateStr}</span>
        <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] brand-panel p-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{monthName}</h3>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-gray-600 dark:text-gray-400 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, index) => (
              <button
                key={index}
                type="button"
                onClick={() => day && !isDateDisabled(day) && handleDateClick(day)}
                disabled={!day || isDateDisabled(day)}
                className={`
                  p-2 rounded-lg text-sm font-medium transition-all
                  ${!day ? 'invisible' : ''}
                  ${isDateDisabled(day) ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : ''}
                  ${isSelected(day) ? 'bg-primary text-white shadow-md' : ''}
                  ${isToday(day) && !isSelected(day) ? 'border-2 border-primary text-primary dark:text-primary-300 bg-primary-50 dark:bg-primary/10' : ''}
                  ${!isSelected(day) && !isToday(day) && !isDateDisabled(day) ? 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700' : ''}
                `}
              >
                {day}
              </button>
            ))}
          </div>

          {/* Today Button */}
          <div className="mt-4 flex items-center justify-between gap-2">
            {allowClear && value && onClear && (
              <button
                type="button"
                onClick={() => {
                  onClear();
                  setIsOpen(false);
                }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                onChange(today);
                setDisplayMonth(new Date(today.getFullYear(), today.getMonth()));
                setIsOpen(false);
              }}
              className="ml-auto rounded-lg px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary/10"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
