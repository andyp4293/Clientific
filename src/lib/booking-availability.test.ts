import { describe, expect, it } from 'vitest';
import { getEmptyAvailabilityState } from './booking-availability';

describe('booking availability empty state', () => {
  it('calls out when the selected staff member is off that day', () => {
    const state = getEmptyAvailabilityState({
      availabilityReason: 'staff_off_day',
      selectedDate: new Date(2026, 2, 17),
      selectedStaffName: 'Jordan',
    });

    expect(state.title).toContain('Jordan is off');
    expect(state.description).toMatch(/Anyone Available/i);
    expect(state.tone).toBe('staff_off');
  });

  it('falls back to a generic no-times message when the day is still open', () => {
    const state = getEmptyAvailabilityState({
      selectedDate: new Date(2026, 2, 17),
    });

    expect(state.title).toContain('No times are available');
    expect(state.description).toMatch(/different staff member/i);
    expect(state.tone).toBe('default');
  });
});
