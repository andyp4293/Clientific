// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PricingPage from './page';
import * as pageModule from './page';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'unauthenticated' }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('page module smoke test', () => {
  it('exports a default page component', () => {
    expect(typeof pageModule.default).toBe('function');
  });

  it('renders FTC-style auto-renewal disclosures on public pricing cards', async () => {
    render(<PricingPage />);

    expect(await screen.findAllByText('Auto-renewal disclosure')).toHaveLength(3);
    expect(screen.getByTestId('auto-renewal-disclosure-starter')).toHaveTextContent(
      'Starter starts with a 14-day free trial. After the trial, Clientific automatically charges $39/month plus applicable taxes until you cancel.',
    );
    expect(screen.getByTestId('auto-renewal-disclosure-pro')).toHaveTextContent(
      'Your subscription renews monthly unless canceled before the next billing date.',
    );
    expect(screen.getByTestId('auto-renewal-disclosure-premium')).toHaveTextContent(
      'access continues until the end of the current paid period',
    );
  });
});
