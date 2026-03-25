// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AddCustomerModal from './AddCustomerModal';
import EditCustomerModal from './EditCustomerModal';

const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock('@/components/ui/DatePicker', () => ({
  DatePicker: ({
    value,
    onChange,
    onClear,
    placeholder,
  }: {
    value: Date | null;
    onChange: (date: Date) => void;
    onClear?: () => void;
    placeholder?: string;
  }) => (
    <div>
      <button type="button" onClick={() => onChange(new Date(2026, 2, 9))}>
        {value ? 'Date Selected' : placeholder ?? 'Select date'}
      </button>
      {onClear && (
        <button type="button" onClick={onClear}>
          Clear Date
        </button>
      )}
    </div>
  ),
}));

describe('Customer modals', () => {
  const groups = [
    { id: 'group-1', name: 'VIP', promotionSmsEnabled: true },
    { id: 'group-2', name: 'No Deals', promotionSmsEnabled: false },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
  });

  it('submits AddCustomerModal with DatePicker birthday format', async () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ customer: { id: 'cust-new', name: 'Alice' } }),
    } as Response);

    render(<AddCustomerModal isOpen onClose={onClose} groups={groups} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Alice' } });
    fireEvent.click(screen.getByRole('button', { name: /select birthday/i }));
    fireEvent.click(screen.getByLabelText(/vip/i));
    fireEvent.click(screen.getByRole('button', { name: /^add customer$/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const payload = JSON.parse((options as RequestInit).body as string);

    expect(payload.birthday).toBe('2026-03-09');
    expect(payload.groupIds).toEqual(['group-1']);
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'cust-new', name: 'Alice' }));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('submits EditCustomerModal with DatePicker birthday format', async () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ customer: { id: 'cus_1', name: 'Bob Updated', dealSmsBlocked: true } }),
    } as Response);
    render(
      <EditCustomerModal
        isOpen
        onClose={onClose}
        onSaved={onSaved}
        customer={{
          id: 'cus_1',
          name: 'Bob',
          email: null,
          phone: null,
          birthday: null,
          notes: null,
          dealSmsBlocked: false,
          groupMemberships: [{ group: groups[1] }],
        }}
        groups={groups}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /select birthday/i }));
    fireEvent.click(screen.getByLabelText(/vip/i));
    fireEvent.click(screen.getByRole('switch', { name: /toggle deals sms messages for this customer/i }));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    const payload = JSON.parse((options as RequestInit).body as string);

    expect(url).toBe('/api/customers/cus_1');
    expect(payload.birthday).toBe('2026-03-09');
    expect(payload.dealSmsBlocked).toBe(true);
    expect(payload.groupIds).toEqual(['group-2', 'group-1']);
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cus_1', name: 'Bob Updated', dealSmsBlocked: true }),
    );
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
