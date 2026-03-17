import { describe, expect, it } from 'vitest';
import {
  removeServiceFromQueryData,
  syncServiceGroupCounts,
  upsertServicesQueryData,
} from './service-cache';

describe('service cache helpers', () => {
  it('upserts services into the shared services query data in sort order', () => {
    type ServiceShape = { id: string; sortOrder: number; groupId: string | null; name: string };
    const current = {
      services: [
        { id: 'svc-1', sortOrder: 0, groupId: null, name: 'Haircut' },
        { id: 'svc-3', sortOrder: 2, groupId: null, name: 'Color' },
      ] as ServiceShape[],
    };

    const next = upsertServicesQueryData(current, {
      id: 'svc-2',
      sortOrder: 1,
      groupId: 'grp-1',
      name: 'Blowout',
    });

    expect(next.services.map((service) => service.id)).toEqual(['svc-1', 'svc-2', 'svc-3']);
  });

  it('replaces an existing service in the shared services query data', () => {
    type ServiceShape = { id: string; sortOrder: number; groupId: string | null; name: string };
    const current = {
      services: [
        { id: 'svc-1', sortOrder: 0, groupId: null, name: 'Haircut' },
      ] as ServiceShape[],
    };

    const next = upsertServicesQueryData(current, {
      id: 'svc-1',
      sortOrder: 0,
      groupId: 'grp-2',
      name: 'Haircut Deluxe',
    });

    expect(next.services).toEqual([
      { id: 'svc-1', sortOrder: 0, groupId: 'grp-2', name: 'Haircut Deluxe' },
    ]);
  });

  it('removes a deleted service from the shared services query data', () => {
    type ServiceShape = { id: string; sortOrder: number; groupId: string | null; name: string };
    const current = {
      services: [
        { id: 'svc-1', sortOrder: 0, groupId: null, name: 'Haircut' },
        { id: 'svc-2', sortOrder: 1, groupId: 'grp-1', name: 'Blowout' },
      ] as ServiceShape[],
    };

    const next = removeServiceFromQueryData(current, 'svc-1');

    expect(next.services.map((service) => service.id)).toEqual(['svc-2']);
  });

  it('syncs service group counts when a service moves between groups', () => {
    const current = {
      groups: [
        { id: 'grp-1', _count: { services: 3 }, name: 'Cuts' },
        { id: 'grp-2', _count: { services: 1 }, name: 'Styling' },
      ],
    };

    const next = syncServiceGroupCounts(current, 'grp-1', 'grp-2');

    expect(next?.groups).toEqual([
      { id: 'grp-1', _count: { services: 2 }, name: 'Cuts' },
      { id: 'grp-2', _count: { services: 2 }, name: 'Styling' },
    ]);
  });
});
