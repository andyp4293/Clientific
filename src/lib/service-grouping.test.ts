import { describe, expect, it } from 'vitest';
import { groupServicesForDisplay } from './service-grouping';

describe('groupServicesForDisplay', () => {
  it('returns flat mode when there are no groups', () => {
    const result = groupServicesForDisplay(
      [
        { id: 's2', name: 'Color', sortOrder: 2, groupId: null },
        { id: 's1', name: 'Cut', sortOrder: 1, groupId: null },
      ],
      []
    );

    expect(result.hasGroups).toBe(false);
    expect(result.flatServices.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(result.groupedSections).toEqual([]);
    expect(result.ungroupedServices).toEqual([]);
  });

  it('returns grouped mode with an ungrouped fallback list', () => {
    const result = groupServicesForDisplay(
      [
        { id: 's1', name: 'Basic Cut', sortOrder: 1, groupId: 'g1' },
        { id: 's2', name: 'Deep Clean', sortOrder: 2, groupId: 'g2' },
        { id: 's3', name: 'Quick Trim', sortOrder: 3, groupId: null },
      ],
      [
        { id: 'g2', name: 'Facials', sortOrder: 2 },
        { id: 'g1', name: 'Hair', sortOrder: 1 },
      ]
    );

    expect(result.hasGroups).toBe(true);
    expect(result.flatServices).toEqual([]);
    expect(result.groupedSections.map((section) => section.group.id)).toEqual(['g1', 'g2']);
    expect(result.groupedSections[0].services.map((service) => service.id)).toEqual(['s1']);
    expect(result.groupedSections[1].services.map((service) => service.id)).toEqual(['s2']);
    expect(result.ungroupedServices.map((service) => service.id)).toEqual(['s3']);
  });
});
