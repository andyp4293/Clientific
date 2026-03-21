import { describe, expect, it } from 'vitest';

import {
  collectAppointmentServiceIds,
  withAppointmentServiceDisplay,
} from './appointment-services';

describe('appointment-services', () => {
  it('collects unique referenced service ids', () => {
    expect(
      collectAppointmentServiceIds([
        { serviceIds: ['svc-gel', 'svc-pedi'] },
        { serviceIds: ['svc-pedi', 'svc-art'] },
        { serviceIds: [] },
      ]),
    ).toEqual(['svc-gel', 'svc-pedi', 'svc-art']);
  });

  it('builds an ordered multi-service display label from serviceIds', () => {
    const [appointment] = withAppointmentServiceDisplay(
      [
        {
          id: 'appt-1',
          serviceIds: ['svc-gel', 'svc-pedi'],
          service: { id: 'svc-gel', name: 'Gel Manicure' },
        },
      ],
      [
        { id: 'svc-pedi', name: 'Gel Pedicure' },
        { id: 'svc-gel', name: 'Gel Manicure' },
      ],
    );

    expect(appointment.services).toEqual([
      { id: 'svc-gel', name: 'Gel Manicure' },
      { id: 'svc-pedi', name: 'Gel Pedicure' },
    ]);
    expect(appointment.serviceDisplayName).toBe('Gel Manicure, Gel Pedicure');
  });

  it('falls back to the primary service when no serviceIds are present', () => {
    const [appointment] = withAppointmentServiceDisplay(
      [
        {
          id: 'appt-2',
          serviceIds: [],
          service: { id: 'svc-cut', name: 'Haircut' },
        },
      ],
      [],
    );

    expect(appointment.services).toEqual([{ id: 'svc-cut', name: 'Haircut' }]);
    expect(appointment.serviceDisplayName).toBe('Haircut');
  });
});
