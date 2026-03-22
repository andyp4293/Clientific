// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SupportPage from './page';

vi.mock('@/components/layout/PublicSiteHeader', () => ({
  PublicSiteHeader: () => <div data-testid="public-site-header" />,
}));

describe('SupportPage', () => {
  it('renders the support email and contact form', () => {
    render(<SupportPage />);

    expect(screen.getByTestId('public-site-header')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /get help from clientific/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'support@clientific.app' })).toHaveAttribute(
      'href',
      'mailto:support@clientific.app'
    );
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send Message' })).toBeInTheDocument();
  });
});
