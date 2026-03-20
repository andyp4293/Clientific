// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import VerifyEmailPage from './page';

const mockSearchParams = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams(),
}));

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.mockReturnValue({
      get: (key: string) => {
        if (key === 'email') return 'owner@example.com';
        return null;
      },
    });

    global.fetch = vi.fn();
  });

  it('prefills the email field and verifies a 6-digit code', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    render(<VerifyEmailPage />);

    expect(screen.getByDisplayValue('owner@example.com')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('000000'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verify code/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/verify-email/confirm',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'owner@example.com',
            code: '123456',
          }),
        })
      );
    });

    expect(
      await screen.findByText(/your email has been verified\. you can now sign in\./i)
    ).toBeInTheDocument();
  });

  it('auto-verifies a legacy token from the query string', async () => {
    mockSearchParams.mockReturnValue({
      get: (key: string) => {
        if (key === 'token') return 'legacy-token';
        return null;
      },
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/verify-email/confirm',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ token: 'legacy-token' }),
        })
      );
    });

    expect(
      await screen.findByText(/your email has been verified\. you can now sign in\./i)
    ).toBeInTheDocument();
  });
});
