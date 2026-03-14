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
  viewerCanManage: false,
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
        confirmationSent: true,
      }),
    } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows a branded mobile intro and switches to the split layout from md upward', () => {
    render(<CaptureKiosk config={baseConfig} />);

    const layout = screen.getByTestId('capture-kiosk-layout');
    const shell = screen.getByTestId('capture-kiosk-shell');
    const hero = screen.getByTestId('capture-kiosk-hero');
    const form = screen.getByTestId('capture-kiosk-form');

    expect(layout.className).toContain('md:grid-cols-[1.05fr,0.95fr]');
    expect(shell.className).toContain('md:contents');
    expect(shell).toContainElement(hero);
    expect(shell).toContainElement(form);
    expect(hero.className).toContain('hidden');
    expect(hero.className).toContain('md:flex');
    expect(form.className).toContain('brand-panel');
    expect(hero.className).toContain('md:order-1');
    expect(form.className).toContain('md:order-2');
    expect(screen.queryByRole('link', { name: /back to dashboard/i })).not.toBeInTheDocument();
    expect(screen.getByText('Clientific')).toBeInTheDocument();
    expect(screen.getByText('Test Salon')).toBeInTheDocument();
    expect(screen.getByText(/join test salon's clientific text list/i)).toBeInTheDocument();
    expect(screen.queryByText("What you'll be joining")).not.toBeInTheDocument();
  });

  it('shows a dashboard back link only for the owning business session', () => {
    render(
      <CaptureKiosk
        config={{
          ...baseConfig,
          viewerCanManage: true,
        }}
      />
    );

    expect(screen.getByRole('link', { name: /back to dashboard/i })).toHaveAttribute(
      'href',
      '/dashboard/campaigns'
    );
  });

  it('supports immediate reset and auto-resets the success screen after 15 seconds', async () => {
    render(<CaptureKiosk config={baseConfig} />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/mobile phone/i), { target: { value: '5551234567' } });
    fireEvent.submit(screen.getByRole('button', { name: /claim offer by text/i }).closest('form')!);

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

    expect(screen.getByText(/you're all set, jane\./i)).toBeInTheDocument();
    expect(screen.getByText('ABCD1234')).toBeInTheDocument();
    expect(screen.getByText(/resets for the next guest in 15 seconds/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset now/i })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(14000);
      await Promise.resolve();
    });

    expect(screen.getByText(/you're all set, jane\./i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reset now/i }));

    expect(screen.getByText(/claim today's offer\./i)).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toHaveValue('');
    expect(screen.getByLabelText(/mobile phone/i)).toHaveValue('');

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/mobile phone/i), { target: { value: '5551234567' } });
    fireEvent.submit(screen.getByRole('button', { name: /claim offer by text/i }).closest('form')!);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(/you're all set, jane\./i)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(15000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(/claim today's offer\./i)).toBeInTheDocument();
  }, 10000);
});
