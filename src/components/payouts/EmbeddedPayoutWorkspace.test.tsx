// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const mockLoadConnectAndInitialize = vi.fn();

vi.mock('@stripe/connect-js/pure', () => ({
  loadConnectAndInitialize: (...args: unknown[]) => mockLoadConnectAndInitialize(...args),
}));

vi.mock('@stripe/react-connect-js', () => ({
  ConnectAccountManagement: () => <div data-testid="connect-account-management" />,
  ConnectAccountOnboarding: () => <div data-testid="connect-account-onboarding" />,
  ConnectComponentsProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="connect-provider">{children}</div>
  ),
  ConnectPayouts: () => <div data-testid="connect-payouts" />,
}));

import { EmbeddedPayoutWorkspace } from './EmbeddedPayoutWorkspace';

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    writable: true,
    configurable: true,
  });
  window.dispatchEvent(new Event('resize'));
}

describe('EmbeddedPayoutWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
    document.documentElement.className = '';
    setViewportWidth(1024);
    mockLoadConnectAndInitialize.mockReturnValue({ id: 'connect-instance' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ clientSecret: 'seti_123_secret_456' }),
      })
    );
  });

  afterEach(() => {
    document.documentElement.className = '';
  });

  it('shows a loading state while Stripe is creating the secure session', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    render(<EmbeddedPayoutWorkspace visible onboardingComplete={false} onRefresh={vi.fn()} />);

    expect(screen.getByTestId('embedded-workspace-loading')).toBeInTheDocument();
    expect(screen.getByText(/loading secure stripe setup/i)).toBeInTheDocument();
  });

  it('uses the light appearance tokens by default', async () => {
    await act(async () => {
      render(<EmbeddedPayoutWorkspace visible onboardingComplete={false} onRefresh={vi.fn()} />);
    });

    await waitFor(() => {
      expect(mockLoadConnectAndInitialize).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByTestId('connect-provider')).toBeInTheDocument();
    });

    const config = mockLoadConnectAndInitialize.mock.calls[0][0];
    expect(config.appearance.overlays).toBe('dialog');
    expect(config.appearance.variables.colorBackground).toBe('#F3F8F7');
    expect(config.appearance.variables.formBackgroundColor).toBe('#F3F8F7');
    expect(config.appearance.variables.borderRadius).toBe('0px');
    expect(config.appearance.variables.formBorderRadius).toBe('0px');
    expect(screen.getByTestId('connect-account-onboarding')).toBeInTheDocument();
  });

  it('switches the embedded workspace to dark appearance tokens and keeps only the live controls', async () => {
    document.documentElement.classList.add('dark');

    await act(async () => {
      render(<EmbeddedPayoutWorkspace visible onboardingComplete onRefresh={vi.fn()} />);
    });

    await waitFor(() => {
      expect(mockLoadConnectAndInitialize).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByTestId('connect-provider')).toBeInTheDocument();
    });

    const config = mockLoadConnectAndInitialize.mock.calls[0][0];
    expect(config.appearance.variables.colorBackground).toBe('#111F26');
    expect(config.appearance.variables.formBackgroundColor).toBe('#111F26');
    expect(config.appearance.variables.borderRadius).toBe('0px');
    expect(config.appearance.variables.buttonBorderRadius).toBe('0px');
    expect(screen.getByTestId('connect-payouts')).toBeInTheDocument();
    expect(screen.getByTestId('connect-account-management')).toBeInTheDocument();
    expect(screen.queryByTestId('connect-balances')).not.toBeInTheDocument();
  });

  it('switches to the larger drawer overlay automatically on desktop widths', async () => {
    setViewportWidth(1440);

    await act(async () => {
      render(<EmbeddedPayoutWorkspace visible onboardingComplete onRefresh={vi.fn()} />);
    });

    await waitFor(() => {
      expect(mockLoadConnectAndInitialize).toHaveBeenCalled();
    });

    const config = mockLoadConnectAndInitialize.mock.calls[0][0];
    expect(config.appearance.overlays).toBe('drawer');
  });

  it('uses the drawer overlay on narrow mobile widths so the payout flow feels fullscreen', async () => {
    setViewportWidth(390);

    await act(async () => {
      render(<EmbeddedPayoutWorkspace visible onboardingComplete onRefresh={vi.fn()} />);
    });

    await waitFor(() => {
      expect(mockLoadConnectAndInitialize).toHaveBeenCalled();
    });

    const config = mockLoadConnectAndInitialize.mock.calls[0][0];
    expect(config.appearance.overlays).toBe('drawer');
  });
});
