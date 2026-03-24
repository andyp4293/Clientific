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
  ConnectNotificationBanner: () => <div data-testid="connect-notification-banner" />,
  ConnectPayouts: () => <div data-testid="connect-payouts" />,
}));

import { EmbeddedPayoutWorkspace } from './EmbeddedPayoutWorkspace';

describe('EmbeddedPayoutWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
    document.documentElement.className = '';
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

  it('uses the light appearance tokens by default', async () => {
    await act(async () => {
      render(
        <EmbeddedPayoutWorkspace
          visible
          onboardingComplete={false}
          detailsSubmitted={false}
          onRefresh={vi.fn()}
        />
      );
    });

    await waitFor(() => {
      expect(mockLoadConnectAndInitialize).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByTestId('connect-provider')).toBeInTheDocument();
    });

    const config = mockLoadConnectAndInitialize.mock.calls[0][0];
    expect(config.appearance.variables.colorBackground).toBe('#F3F8F7');
    expect(config.appearance.variables.formBackgroundColor).toBe('#F8FCFB');
    expect(screen.getByTestId('connect-account-onboarding')).toBeInTheDocument();
  });

  it('shows a loading state while secure Stripe controls initialize', async () => {
    let resolveFetch: ((value: unknown) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          })
      )
    );

    render(
      <EmbeddedPayoutWorkspace
        visible
        onboardingComplete
        detailsSubmitted
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByText(/loading secure stripe payout controls/i)).toBeInTheDocument();

    resolveFetch?.({
      ok: true,
      json: async () => ({ clientSecret: 'seti_123_secret_456' }),
    });

    await waitFor(() => {
      expect(screen.getByTestId('connect-provider')).toBeInTheDocument();
    });
  });

  it('switches the embedded workspace to dark appearance tokens and removes the redundant balances embed', async () => {
    document.documentElement.classList.add('dark');

    await act(async () => {
      render(
        <EmbeddedPayoutWorkspace
          visible
          onboardingComplete
          detailsSubmitted
          onRefresh={vi.fn()}
        />
      );
    });

    await waitFor(() => {
      expect(mockLoadConnectAndInitialize).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByTestId('connect-provider')).toBeInTheDocument();
    });

    const config = mockLoadConnectAndInitialize.mock.calls[0][0];
    expect(config.appearance.variables.colorBackground).toBe('#0C1720');
    expect(config.appearance.variables.formBackgroundColor).toBe('#0C1720');
    expect(screen.getByTestId('connect-payouts')).toBeInTheDocument();
    expect(screen.getByTestId('connect-account-management')).toBeInTheDocument();
    expect(screen.queryByTestId('connect-balances')).not.toBeInTheDocument();
  });

  it('uses setup-specific loading copy while onboarding is incomplete', async () => {
    let resolveFetch: ((value: unknown) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          })
      )
    );

    render(
      <EmbeddedPayoutWorkspace
        visible
        onboardingComplete={false}
        detailsSubmitted={false}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByText(/loading secure stripe verification/i)).toBeInTheDocument();

    resolveFetch?.({
      ok: true,
      json: async () => ({ clientSecret: 'seti_123_secret_456' }),
    });

    await waitFor(() => {
      expect(screen.getByTestId('connect-provider')).toBeInTheDocument();
    });
  });

  it('reuses the first client secret once and fetches a fresh account session when Stripe asks again', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ clientSecret: 'seti_first_secret' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ clientSecret: 'seti_second_secret' }),
      });

    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      render(
        <EmbeddedPayoutWorkspace
          visible
          onboardingComplete={false}
          detailsSubmitted={false}
          onRefresh={vi.fn()}
        />
      );
    });

    await waitFor(() => {
      expect(mockLoadConnectAndInitialize).toHaveBeenCalled();
    });

    const config = mockLoadConnectAndInitialize.mock.calls[0][0];
    await expect(config.fetchClientSecret()).resolves.toBe('seti_first_secret');
    await expect(config.fetchClientSecret()).resolves.toBe('seti_second_secret');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('explains that Stripe re-auth continues verification instead of restarting setup', async () => {
    await act(async () => {
      render(
        <EmbeddedPayoutWorkspace
          visible
          onboardingComplete={false}
          detailsSubmitted={false}
          onRefresh={vi.fn()}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('connect-provider')).toBeInTheDocument();
    });

    expect(screen.getByText(/if stripe asks you to confirm again, keep going/i)).toBeInTheDocument();
    expect(screen.getByText(/does not restart setup/i)).toBeInTheDocument();
  });

  it('shows Stripe review controls instead of replaying onboarding after details are submitted', async () => {
    await act(async () => {
      render(
        <EmbeddedPayoutWorkspace
          visible
          onboardingComplete={false}
          detailsSubmitted
          requirements={{
            currentlyDue: [],
            eventuallyDue: [],
            pastDue: [],
            pendingVerification: ['individual.verification.document'],
            disabledReason: 'requirements.pending_verification',
          }}
          onRefresh={vi.fn()}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('connect-provider')).toBeInTheDocument();
    });

    expect(screen.getByTestId('connect-notification-banner')).toBeInTheDocument();
    expect(screen.queryByTestId('connect-account-onboarding')).not.toBeInTheDocument();
    expect(screen.getByText(/stripe is reviewing the submitted payout details/i)).toBeInTheDocument();
    expect(screen.getByText(/reload secure stripe session/i)).toBeInTheDocument();
  });
});
