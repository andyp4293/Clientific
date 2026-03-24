// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AiReceptionistManager from './AiReceptionistManager';

const mockInvalidateQueries = vi.fn();
let mockBusinessResponse = {
  business: {
    id: 'biz-1',
    name: 'Test Salon',
    subscriptionPlan: 'pro',
    aiReceptionistEnabled: true,
    aiReceptionistPhone: '+15551234567',
    aiReceptionistGreeting: null,
    aiReceptionistFaq: [],
    smsAiEnabled: true,
    smsAiPhoneNumber: '+19084184377',
    smsAiGreeting: null,
    vapiPhoneNumber: '+19084184377',
  },
};

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: mockBusinessResponse,
    isLoading: false,
  }),
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AiReceptionistManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBusinessResponse = {
      business: {
        id: 'biz-1',
        name: 'Test Salon',
        subscriptionPlan: 'pro',
        aiReceptionistEnabled: true,
        aiReceptionistPhone: '+15551234567',
        aiReceptionistGreeting: null,
        aiReceptionistFaq: [],
        smsAiEnabled: true,
        smsAiPhoneNumber: '+19084184377',
        smsAiGreeting: null,
        vapiPhoneNumber: '+19084184377',
      },
    };
  });

  it('keeps forwarding help collapsed until the user opens it', () => {
    render(<AiReceptionistManager />);

    expect(
      screen.getByRole('button', { name: /How to forward calls to this number/i })
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('heading', { name: 'iPhone' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Need help\? Contact support/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /How to forward calls to this number/i }));

    expect(
      screen.getByText(
        /Want all calls to go straight to your AI receptionist\? Follow the steps for your phone type below\./i
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'iPhone' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Android' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Landline' })).toBeInTheDocument();
    expect(screen.getByText('*21*+19084184377#')).toBeInTheDocument();
    expect(screen.getAllByText(/\+19084184377/).length).toBeGreaterThan(0);

    expect(screen.getByRole('link', { name: /Need help\? Contact support/i })).toHaveAttribute(
      'href',
      '/support'
    );

    expect(
      screen.getByRole('button', { name: /How to turn off forwarding/i })
    ).toHaveAttribute('aria-expanded', 'false');
  }, 15000);

  it('shows an upgrade message instead of AI controls on Starter', () => {
    mockBusinessResponse = {
      business: {
        ...mockBusinessResponse.business,
        subscriptionPlan: 'starter',
        aiReceptionistEnabled: false,
        smsAiEnabled: false,
        smsAiPhoneNumber: null,
        vapiPhoneNumber: null,
      },
    };

    render(<AiReceptionistManager />);

    expect(screen.getByText(/upgrade to turn on ai phone coverage/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view pro pricing/i })).toHaveAttribute(
      'href',
      '/pricing'
    );
    expect(screen.queryByText(/enable ai receptionist/i)).not.toBeInTheDocument();
  });
});
