// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/public/PublicOwnerBackButton', () => ({
  PublicOwnerBackButton: ({ label }: { label: string }) => <button type="button">{label}</button>,
}));

import CheckInKiosk from './CheckInKiosk';

const KIOSK_INTERACTION_TEST_TIMEOUT = 10_000;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('CheckInKiosk', () => {
  function renderKiosk(viewerCanManage = false) {
    return render(
      <CheckInKiosk
        business={{ name: 'ABC Nails', publicId: 'pub_123', logoUrl: null }}
        viewerCanManage={viewerCanManage}
      />
    );
  }

  function tapKeypadDigits(digits: string) {
    for (const digit of digits) {
      fireEvent.click(screen.getByRole('button', { name: digit }));
    }
  }

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
    renderKiosk(true);

    expect(screen.getByRole('button', { name: 'Back to dashboard' })).toBeInTheDocument();
  });

  it('uses the compact kiosk layout needed for constrained iPad Safari sheets', () => {
    const { container } = renderKiosk();
    const shell = container.firstElementChild;

    expect(shell).toHaveClass('kiosk-page-shell');
    expect(shell).not.toHaveClass('overflow-x-hidden');
    expect(screen.getByRole('button', { name: '1' })).toHaveClass('kiosk-keypad-button');
    expect(screen.getByRole('button', { name: '1' })).toHaveClass('min-h-[58px]');
    expect(screen.getByText('(___) ___-____')).toHaveClass('whitespace-nowrap');
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveClass('min-h-[52px]');
  });

  it('formats keypad taps, caps extra digits, and supports delete and clear', () => {
    renderKiosk();
    const continueButton = screen.getByRole('button', { name: 'Continue' });

    expect(continueButton).toBeDisabled();

    tapKeypadDigits('201555018899');

    expect(screen.getByText('(201) 555-0188')).toBeInTheDocument();
    expect(screen.queryByText('(201) 555-018899')).not.toBeInTheDocument();
    expect(continueButton).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect(screen.getByText('(201) 555-018')).toBeInTheDocument();
    expect(continueButton).toBeDisabled();

    const keypadClearButton = screen.getAllByRole('button', { name: 'Clear' }).at(-1);
    expect(keypadClearButton).toBeDefined();
    fireEvent.click(keypadClearButton!);

    expect(screen.getByText('(___) ___-____')).toBeInTheDocument();
    expect(continueButton).toBeDisabled();
  }, KIOSK_INTERACTION_TEST_TIMEOUT);

  it('checks in an existing customer immediately from keypad entry', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'existing',
          customer: {
            id: 'cust_123',
            name: 'Jane Smith',
            phone: '2015550188',
            email: null,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          checkIn: {
            checkInTime: '2026-06-17T23:12:00.000Z',
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    renderKiosk();
    tapKeypadDigits('2015550188');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(screen.getByText('Thanks, Jane.')).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/public/business-by-id/pub_123/check-in?phone=2015550188'
    );
    expect(fetchMock.mock.calls[1][0]).toBe('/api/public/business-by-id/pub_123/check-in');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      customerId: 'cust_123',
      phone: '2015550188',
    });
  }, KIOSK_INTERACTION_TEST_TIMEOUT);

  it('shows lookup errors without leaving the keypad flow', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Check-in lookup is temporarily unavailable.' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderKiosk();
    tapKeypadDigits('2015550188');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(screen.getByText('Check-in lookup is temporarily unavailable.')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
    expect(screen.getByText('(201) 555-0188')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  }, KIOSK_INTERACTION_TEST_TIMEOUT);

  it('shows a checked SMS consent checkbox on the new-customer step', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'new',
        normalizedPhone: '8482612613',
        displayPhone: '(848) 261-2613',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderKiosk();

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
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/public/business-by-id/pub_123/check-in?phone=8482612613'
    );
  }, KIOSK_INTERACTION_TEST_TIMEOUT);
});
