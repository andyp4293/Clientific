// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CustomerList from './CustomerList';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('./AddCustomerModal', () => ({
  default: () => null,
}));

vi.mock('./EditCustomerModal', () => ({
  default: () => null,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('CustomerList messaging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);
  });

  it('opens the text composer and posts a direct message for an eligible customer', async () => {
    render(
      <CustomerList
        customers={[
          {
            id: 'cust-1',
            name: 'Jane Doe',
            email: 'jane@example.com',
            phone: '+15551234567',
            smsConsent: true,
            smsOptedOut: false,
            segment: 'VIP',
            points: 120,
            totalSpent: 250,
            lastVisit: new Date('2026-03-12T12:00:00.000Z'),
            birthday: null,
            notes: null,
            createdAt: new Date('2026-03-01T12:00:00.000Z'),
            _count: {
              checkIns: 3,
              appointments: 4,
            },
          },
        ]}
        segmentCounts={[{ segment: 'VIP', _count: 1 }]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^text$/i }));

    expect(screen.getByRole('heading', { name: /send text to jane doe/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^message$/i), {
      target: { value: 'We have an opening tomorrow at 2 PM.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^send text$/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/api/customers/cust-1/message');
    expect(options).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse((options as RequestInit).body as string)).toEqual({
      message: 'We have an opening tomorrow at 2 PM.',
    });
  });

  it('shows SMS status badges for opted-out and subscribed customers', () => {
    render(
      <CustomerList
        customers={[
          {
            id: 'cust-1',
            name: 'Jane Doe',
            email: 'jane@example.com',
            phone: '+15551234567',
            smsConsent: true,
            smsOptedOut: false,
            segment: 'VIP',
            points: 120,
            totalSpent: 250,
            lastVisit: new Date('2026-03-12T12:00:00.000Z'),
            birthday: null,
            notes: null,
            createdAt: new Date('2026-03-01T12:00:00.000Z'),
            _count: {
              checkIns: 3,
              appointments: 4,
            },
          },
          {
            id: 'cust-2',
            name: 'John Smith',
            email: 'john@example.com',
            phone: '+15557654321',
            smsConsent: false,
            smsOptedOut: true,
            segment: 'REGULAR',
            points: 40,
            totalSpent: 90,
            lastVisit: null,
            birthday: null,
            notes: null,
            createdAt: new Date('2026-03-02T12:00:00.000Z'),
            _count: {
              checkIns: 1,
              appointments: 1,
            },
          },
        ]}
        segmentCounts={[
          { segment: 'VIP', _count: 1 },
          { segment: 'REGULAR', _count: 1 },
        ]}
      />
    );

    expect(screen.getByText('SMS Status')).toBeInTheDocument();
    expect(screen.getByText('Subscribed')).toBeInTheDocument();
    expect(screen.getByText('Can receive SMS')).toBeInTheDocument();
    expect(screen.getByText('Opted out')).toBeInTheDocument();
    expect(screen.getByText('Stopped SMS')).toBeInTheDocument();
  });
});
