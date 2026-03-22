// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AiReceptionistManager from './AiReceptionistManager';

const mockInvalidateQueries = vi.fn();
const mockBusinessResponse = {
  business: {
    id: 'biz-1',
    name: 'Test Salon',
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
  });

  it('renders beginner-friendly call forwarding instructions with the live AI number', () => {
    render(<AiReceptionistManager />);

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

    const turnOffDetails = screen.getByTestId('turn-off-forwarding-details');
    expect(turnOffDetails).not.toHaveAttribute('open');

    expect(screen.getByRole('link', { name: /Need help\? Contact support/i })).toHaveAttribute(
      'href',
      '/support'
    );
  });
});
