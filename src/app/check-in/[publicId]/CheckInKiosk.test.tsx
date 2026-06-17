// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/public/PublicOwnerBackButton', () => ({
  PublicOwnerBackButton: ({ label }: { label: string }) => <button type="button">{label}</button>,
}));

import CheckInKiosk from './CheckInKiosk';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CheckInKiosk', () => {
  it('shows the business name prominently with the simpler enter-your-number copy', () => {
    render(
      <CheckInKiosk
        business={{ name: 'ABC Nails', publicId: 'pub_123', logoUrl: 'https://example.com/logo.png' }}
        viewerCanManage={false}
      />
    );

    expect(screen.getByRole('heading', { name: 'ABC Nails' })).toBeInTheDocument();
    expect(screen.getByText('Enter your number')).toBeInTheDocument();
    expect(screen.queryByText('The +1 is already built in.')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('keeps the owner back action when the logged-in business opens the page', () => {
    render(
      <CheckInKiosk
        business={{ name: 'ABC Nails', publicId: 'pub_123', logoUrl: null }}
        viewerCanManage
      />
    );

    expect(screen.getByRole('button', { name: 'Back to dashboard' })).toBeInTheDocument();
  });

  it('uses the compact kiosk layout needed for constrained iPad Safari sheets', () => {
    const { container } = render(
      <CheckInKiosk
        business={{ name: 'ABC Nails', publicId: 'pub_123', logoUrl: null }}
        viewerCanManage={false}
      />
    );
    const shell = container.firstElementChild;

    expect(shell).toHaveClass('kiosk-page-shell');
    expect(shell).not.toHaveClass('overflow-x-hidden');
    expect(screen.getByRole('button', { name: '1' })).toHaveClass('kiosk-keypad-button');
    expect(screen.getByRole('button', { name: '1' })).toHaveClass('min-h-[58px]');
    expect(screen.getByText('(___) ___-____')).toHaveClass('whitespace-nowrap');
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveClass('min-h-[52px]');
  });

  it('shows a checked SMS consent checkbox on the new-customer step', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'new',
        normalizedPhone: '8482612613',
        displayPhone: '(848) 261-2613',
      }),
    } as never);

    render(
      <CheckInKiosk
        business={{ name: 'ABC Nails', publicId: 'pub_123', logoUrl: null }}
        viewerCanManage={false}
      />
    );

    for (const digit of '8482612613') {
      fireEvent.keyDown(window, { key: digit });
    }

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(screen.getByText('Save this number once and move on')).toBeInTheDocument();
    });

    const smsConsentCheckbox = screen.getByRole('checkbox', {
      name: /yes, text me visit updates and future offers from abc nails\./i,
    });

    expect(smsConsentCheckbox).toBeChecked();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/public/business-by-id/pub_123/check-in?phone=8482612613'
    );
  });
});
