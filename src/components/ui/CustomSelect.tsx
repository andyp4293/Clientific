'use client';

import { useEffect, useRef, useState } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** Applied to the trigger button; pass 'input' or 'input text-sm' etc. */
  className?: string;
  disabled?: boolean;
  id?: string;
  required?: boolean;
  /** Label shown when value is '' (renders as a selectable empty option). */
  placeholder?: string;
  ariaLabel?: string;
}

export function CustomSelect({
  options,
  value,
  onChange,
  className = 'input',
  disabled = false,
  id,
  required = false,
  placeholder,
  ariaLabel,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value);
  const displayLabel = selected?.label ?? placeholder ?? '';
  const isEmpty = !selected;

  useEffect(() => {
    if (!open) return;

    const onMouseDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((isOpen) => !isOpen)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${className} flex w-full items-center justify-between gap-2 text-left transition-[border-color,box-shadow,background-color] ${
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        } ${isEmpty ? 'text-gray-400 dark:text-gray-500' : ''} ${
          open
            ? 'border-primary/60 shadow-[0_0_0_4px_rgba(24,166,120,0.12)] dark:shadow-[0_0_0_4px_rgba(52,211,153,0.12)]'
            : ''
        }`}
      >
        <span className="truncate">{displayLabel}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-150 ${
            open ? 'rotate-180 text-primary dark:text-primary-300' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {required && (
        <select
          tabIndex={-1}
          aria-hidden="true"
          value={value}
          onChange={() => {}}
          required
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        >
          <option value="" />
          {options.map((option) => (
            <option key={option.value} value={option.value} />
          ))}
        </select>
      )}

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-gray-200/90 bg-white/95 p-1.5 shadow-[0_28px_70px_-30px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-gray-900/95"
        >
          {placeholder !== undefined && (
            <li
              key="__placeholder__"
              role="option"
              aria-selected={value === ''}
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                value === ''
                  ? 'bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary-300'
                  : 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/80'
              }`}
            >
              <span className="flex-1 truncate">{placeholder}</span>
              {value === '' && <CheckIcon />}
            </li>
          )}

          {options.map((option) => (
            <li
              key={option.value}
              role="option"
              aria-selected={value === option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                value === option.value
                  ? 'bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary-300'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/80'
              }`}
            >
              <span className="flex-1 truncate">{option.label}</span>
              {value === option.value && <CheckIcon />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}
