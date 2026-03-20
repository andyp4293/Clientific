/**
 * Component tests for the Referrals page.
 * These catch client-side rendering crashes that API route tests miss.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Test Business' } }, status: 'authenticated' }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('qrcode.react', () => ({
  QRCodeCanvas: () => <canvas data-testid="qr-canvas" />,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('lucide-react', () => ({
  Gift: () => <svg data-testid="icon-gift" />,
  Copy: () => <svg data-testid="icon-copy" />,
  Download: () => <svg data-testid="icon-download" />,
  Users: () => <svg data-testid="icon-users" />,
  CheckCircle: () => <svg data-testid="icon-check" />,
  Clock: () => <svg data-testid="icon-clock" />,
  TrendingUp: () => <svg data-testid="icon-trending" />,
}));

import { useQuery } from '@tanstack/react-query';
import ReferralsPage from '@/app/(dashboard)/dashboard/referrals/page';

const mockUseQuery = vi.mocked(useQuery);

function makeReferral(status: 'active' | 'credited' | 'pending', name = 'Test Salon') {
  return {
    id: `ref-${Math.random()}`,
    createdAt: '2026-01-01T00:00:00Z',
    status,
    creditAmount: 15,
    creditedAt: status !== 'pending' ? '2026-02-01T00:00:00Z' : null,
    referee: { name, createdAt: '2026-01-01T00:00:00Z' },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('ReferralsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: mock clipboard API
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders without crash while loading (data is undefined)', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true } as any);
    expect(() => render(<ReferralsPage />)).not.toThrow();
  });

  it('renders without crash when referrals property is undefined (the bug case)', () => {
    mockUseQuery.mockReturnValue({
      data: { referralCode: 'ABC12345', totalCredits: 0, referrals: undefined },
      isLoading: false,
    } as any);
    expect(() => render(<ReferralsPage />)).not.toThrow();
  });

  it('shows skeleton placeholders while loading', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true } as any);
    const { container } = render(<ReferralsPage />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBeGreaterThan(0);
  });

  it('shows total credits earned', () => {
    mockUseQuery.mockReturnValue({
      data: { referralCode: 'ABC12345', totalCredits: 30, referrals: [] },
      isLoading: false,
    } as any);
    render(<ReferralsPage />);
    expect(screen.getByText('$30')).toBeInTheDocument();
  });

  it('shows correct active count (includes credited for backward compat)', () => {
    mockUseQuery.mockReturnValue({
      data: {
        referralCode: 'ABC12345',
        totalCredits: 30,
        referrals: [makeReferral('active'), makeReferral('credited'), makeReferral('pending')],
      },
      isLoading: false,
    } as any);
    render(<ReferralsPage />);
    // Active stat box shows "2" (active + credited both count)
    const activeEl = screen.getByText('Active').previousSibling;
    expect(activeEl?.textContent).toBe('2');
  });

  it('shows correct pending count', () => {
    mockUseQuery.mockReturnValue({
      data: {
        referralCode: 'ABC12345',
        totalCredits: 15,
        referrals: [makeReferral('active'), makeReferral('pending'), makeReferral('pending')],
      },
      isLoading: false,
    } as any);
    render(<ReferralsPage />);
    // "In trial" appears in the stat box and as badges — first occurrence is the stat label
    const trialLabel = screen.getAllByText('In trial')[0];
    expect(trialLabel.previousSibling?.textContent).toBe('2');
  });

  it('renders referral link input containing the referral code', () => {
    mockUseQuery.mockReturnValue({
      data: { referralCode: 'MYCODE12', totalCredits: 0, referrals: [] },
      isLoading: false,
    } as any);
    render(<ReferralsPage />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toContain('ref=MYCODE12');
  });

  it('copy button calls clipboard.writeText with the referral link', async () => {
    mockUseQuery.mockReturnValue({
      data: { referralCode: 'MYCODE12', totalCredits: 0, referrals: [] },
      isLoading: false,
    } as any);
    render(<ReferralsPage />);
    const copyBtn = screen.getByRole('button', { name: /copy/i });
    await userEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('ref=MYCODE12')
    );
  });

  it('shows "No referrals yet" when referrals array is empty', () => {
    mockUseQuery.mockReturnValue({
      data: { referralCode: 'MYCODE12', totalCredits: 0, referrals: [] },
      isLoading: false,
    } as any);
    render(<ReferralsPage />);
    expect(screen.getByText('No referrals yet')).toBeInTheDocument();
  });

  it('shows referee names in the referral list', () => {
    mockUseQuery.mockReturnValue({
      data: {
        referralCode: 'MYCODE12',
        totalCredits: 15,
        referrals: [makeReferral('active', 'Janes Nails'), makeReferral('pending', 'Cuts by Bob')],
      },
      isLoading: false,
    } as any);
    render(<ReferralsPage />);
    expect(screen.getByText('Janes Nails')).toBeInTheDocument();
    expect(screen.getByText('Cuts by Bob')).toBeInTheDocument();
  });

  it('describes referral earnings as Stripe payouts instead of direct cashout copy', () => {
    mockUseQuery.mockReturnValue({
      data: { referralCode: 'MYCODE12', totalCredits: 15, referrals: [makeReferral('active')] },
      isLoading: false,
    } as any);

    render(<ReferralsPage />);

    expect(
      screen.getByText(/those earnings stack and move into your stripe payout balance/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/completed earnings move into your stripe payouts once your payout setup is ready/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/paid out directly to you/i)).not.toBeInTheDocument();
  });
});
