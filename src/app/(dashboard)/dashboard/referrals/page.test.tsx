// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (config: unknown) => mockUseQuery(config),
}));

vi.mock('qrcode.react', () => ({
  QRCodeCanvas: () => <div data-testid="qr-code" />,
}));

import ReferralsPage from './page';

describe('ReferralsPage', () => {
  it('keeps the intentionally centered shell', () => {
    mockUseQuery.mockReturnValue({
      data: {
        referralCode: 'abc123',
        totalCredits: 0,
        referrals: [],
        payoutReady: true,
        payoutStatusCode: 'ready',
        payoutSetupMessage: null,
      },
      isLoading: false,
    });

    render(<ReferralsPage />);

    const page = screen.getByTestId('referrals-page');
    expect(page).toHaveClass('max-w-2xl');
    expect(page).toHaveClass('mx-auto');
  });
});
