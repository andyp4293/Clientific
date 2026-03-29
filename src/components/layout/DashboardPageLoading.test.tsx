// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardPageLoading } from './DashboardPageLoading';

describe('DashboardPageLoading', () => {
  it('renders the shared dashboard loading shell with configurable skeleton counts', () => {
    render(<DashboardPageLoading metrics={4} sidePanels={3} />);

    const shell = screen.getByTestId('dashboard-page-loading');
    expect(shell).toHaveAttribute('aria-busy', 'true');
    expect(shell.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(4);
  });
});
