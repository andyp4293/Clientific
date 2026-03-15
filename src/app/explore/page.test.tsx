// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExplorePage from './page';

vi.mock('@/components/ui/LocationAutocomplete', () => ({
  default: ({
    value,
    onChange,
    placeholder,
    inputClassName,
    className,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    inputClassName?: string;
    className?: string;
  }) => (
    <input
      aria-label={placeholder ?? 'Location'}
      className={`${className ?? ''} ${inputClassName ?? ''}`.trim()}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock('@/components/layout/PublicSiteHeader', () => ({
  PublicSiteHeader: () => <div data-testid="public-site-header" />,
}));

describe('ExplorePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        deals: [
          {
            id: 'deal-1',
            title: 'Spring manicure special',
            discountType: 'percent_off',
            discountValue: 15,
            expiresAt: '2099-04-02T00:00:00.000Z',
            business: {
              name: 'Test Nail Salon',
              businessType: 'salon',
              city: 'Brick',
              slug: 'test-nail-salon',
              publicId: 'pub-1',
            },
          },
        ],
      }),
    } as Response);
  });

  it('renders deal discount badges with stronger contrast in light and dark themes', async () => {
    render(<ExplorePage />);

    const badge = await screen.findByText('15% off');

    expect(badge).toHaveClass(
      'border',
      'border-primary-200',
      'bg-primary-50',
      'text-primary-900',
      'dark:border-primary/30',
      'dark:bg-primary/12',
      'dark:text-primary-100'
    );
  });
});
