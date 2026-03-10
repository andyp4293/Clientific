import { describe, expect, it } from 'vitest';
import { toggleServiceSelection } from './service-selection';

describe('toggleServiceSelection', () => {
  it('adds a service when it is not selected', () => {
    const result = toggleServiceSelection(
      [{ id: 's1', name: 'Cut' }],
      { id: 's2', name: 'Color' }
    );

    expect(result.map((service) => service.id)).toEqual(['s1', 's2']);
  });

  it('removes a service when it is already selected', () => {
    const result = toggleServiceSelection(
      [
        { id: 's1', name: 'Cut' },
        { id: 's2', name: 'Color' },
      ],
      { id: 's2', name: 'Color' }
    );

    expect(result.map((service) => service.id)).toEqual(['s1']);
  });
});
