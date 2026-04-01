// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TermsOfServicePage from './page';

describe('Terms of service page', () => {
  it('renders current platform terms and trial language', () => {
    render(<TermsOfServicePage />);

    expect(screen.getByRole('heading', { name: /terms of service/i })).toBeInTheDocument();
    expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
    expect(screen.getByText(/april 1, 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/14-day free trial/i)).toBeInTheDocument();
    expect(screen.getByText(/stripe-connected payout workflows/i)).toBeInTheDocument();
    expect(screen.getByText(/if you enable the optional ai receptionist/i)).toBeInTheDocument();
    expect(screen.getAllByText(/app stores and device platforms/i)).toHaveLength(2);
    expect(screen.getByText(/licensed application end user license agreement/i)).toBeInTheDocument();
  });
});
