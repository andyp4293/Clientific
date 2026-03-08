import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DashboardIcon } from '@/components/layout/nav-icons';
import { DASHBOARD_NAV_ITEMS } from '@/lib/navigation';

describe('DashboardIcon', () => {
  it.each(DASHBOARD_NAV_ITEMS.map((item) => item.icon))('renders "%s" icon', (icon) => {
    const { container } = render(<DashboardIcon icon={icon} className="h-5 w-5" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    const { container } = render(<DashboardIcon icon="home" className="h-7 w-7 text-red-500" />);
    expect(container.querySelector('svg')).toHaveClass('h-7', 'w-7', 'text-red-500');
  });
});
