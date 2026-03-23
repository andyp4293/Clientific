// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/public/PublicOwnerBackButton', () => ({
  PublicOwnerBackButton: ({ label }: { label: string }) => <button type="button">{label}</button>,
}));

import CheckInKiosk from './CheckInKiosk';

describe('CheckInKiosk', () => {
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
    render(
      <CheckInKiosk
        business={{ name: 'ABC Nails', publicId: 'pub_123', logoUrl: null }}
        viewerCanManage
      />
    );

    expect(screen.getByRole('button', { name: 'Back to dashboard' })).toBeInTheDocument();
  });
});
