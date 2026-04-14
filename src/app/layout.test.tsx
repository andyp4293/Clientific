import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';
import RootLayout from './layout';

vi.mock('@vercel/analytics/react', () => ({
  Analytics: () => <div data-testid="vercel-analytics" />,
}));

vi.mock('next/font/google', () => ({
  Inter: () => ({ className: 'inter-font' }),
}));

vi.mock('@/components/providers/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/providers/QueryProvider', () => ({
  QueryProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/providers/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ServiceWorkerRegistration', () => ({
  __esModule: true,
  default: () => <div data-testid="service-worker-registration" />,
}));

describe('RootLayout', () => {
  it('mounts Vercel Analytics for the web app shell', () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <div>Dashboard shell</div>
      </RootLayout>,
    );

    expect(markup).toContain('Dashboard shell');
    expect(markup).toContain('data-testid="vercel-analytics"');
    expect(markup).toContain('data-testid="service-worker-registration"');
  });
});
