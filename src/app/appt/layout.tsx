'use client';

import { useEffect } from 'react';

export default function ApptLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, []);

  return <>{children}</>;
}
