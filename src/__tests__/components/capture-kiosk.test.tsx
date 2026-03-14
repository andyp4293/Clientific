import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import CaptureKiosk from '@/app/capture/[publicId]/CaptureKiosk';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} alt={String(props.alt ?? '')} />,
}));

const baseConfig = {
  business: {
    name: 'Test Salon',
    publicId: 'pub_123',
    slug: 'test-salon',
    logoUrl: null,
    publicProfileHeadline: 'Join for specials',
    bookingEnabled: true,
  },
  deal: {
    id: 'deal-1',
    title: 'Spring Special',
    description: null,
    discountLabel: '20% off',
    expiresAt: '2026-03-20T00:00:00.000Z',
    serviceName: 'Gel manicure',
  },
  captureUrl: 'https://clientific.app/capture/pub_123?deal=deal-1',
  bookingUrl: 'https://clientific.app/book/test-salon',
};

describe('CaptureKiosk', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        deal: {
          code: 'ABCD1234',
          title: 'Spring Special',
          expiresAt: '2026-03-20T00:00:00.000Z',
        },
        dealIssue: null,
        bookingUrl: 'https://clientific.app/book/test-salon',
        confirmationSent: true,
      }),
    } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('holds on the success state until staff manually resets for the next customer', async () => {
    render(<CaptureKiosk config={baseConfig} />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/mobile phone/i), { target: { value: '5551234567' } });
    fireEvent.submit(screen.getByRole('button', { name: /join & claim offer/i }).closest('form')!);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/public/business-by-id/pub_123/capture',
      expect.objectContaining({
        method: 'POST',
      })
    );

    expect(screen.getByText(/your spring special code is ready/i)).toBeInTheDocument();
    expect(screen.getByText('ABCD1234')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });

    expect(screen.getByText(/your spring special code is ready/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reset for next customer/i }));

    expect(screen.getByText(/enter your info to get the code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toHaveValue('');
    expect(screen.getByLabelText(/mobile phone/i)).toHaveValue('');
  }, 10000);
});
