'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const SunIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
  </svg>
);

const MoonIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);

const SystemIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const themes = ['light', 'dark', 'system'] as const;
type Theme = (typeof themes)[number];

const labels: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

const icons: Record<Theme, React.ReactNode> = {
  light: <SunIcon />,
  dark: <MoonIcon />,
  system: <SystemIcon />,
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const current = (theme as Theme) ?? 'system';

  function cycle() {
    const idx = themes.indexOf(current);
    setTheme(themes[(idx + 1) % themes.length]);
  }

  return (
    <button
      onClick={cycle}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white"
      title={`Theme: ${labels[current]} - click to change`}
    >
      <span>{icons[current]}</span>
      <span>{labels[current]}</span>
    </button>
  );
}
