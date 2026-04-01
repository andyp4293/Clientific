// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PrivacyPolicyPage from './page';

describe('Privacy policy page', () => {
  it('renders current product-specific privacy disclosures', () => {
    render(<PrivacyPolicyPage />);

    expect(screen.getByRole('heading', { name: /privacy policy/i })).toBeInTheDocument();
    expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
    expect(screen.getByText(/april 1, 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/billing and payout data/i)).toBeInTheDocument();
    expect(screen.getByText(/mobile app session data/i)).toBeInTheDocument();
    expect(screen.getByText(/we do not sell personal information for money/i)).toBeInTheDocument();
    expect(screen.getByText(/level of privacy and security consistent with this privacy policy/i)).toBeInTheDocument();
    expect(screen.getByText(/california consumer privacy act/i)).toBeInTheDocument();
  });
});
