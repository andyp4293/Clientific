interface QueryWithServices<TService> {
  services: TService[];
}

interface QueryWithGroups<TGroup> {
  groups: TGroup[];
}

interface ServiceLike {
  id: string;
  sortOrder: number;
  groupId: string | null;
}

interface ServiceGroupLike {
  id: string;
  _count?: { services: number };
}

export function upsertServicesQueryData<TService extends ServiceLike>(
  current: QueryWithServices<TService> | undefined,
  nextService: TService
): QueryWithServices<TService> {
  const existingServices = current?.services ?? [];
  const nextServices = existingServices.filter((service) => service.id !== nextService.id);

  nextServices.push(nextService);
  nextServices.sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));

  return { services: nextServices };
}

export function removeServiceFromQueryData<TService extends ServiceLike>(
  current: QueryWithServices<TService> | undefined,
  serviceId: string
): QueryWithServices<TService> {
  return {
    services: (current?.services ?? []).filter((service) => service.id !== serviceId),
  };
}

export function syncServiceGroupCounts<TGroup extends ServiceGroupLike>(
  current: QueryWithGroups<TGroup> | undefined,
  previousGroupId: string | null,
  nextGroupId: string | null
): QueryWithGroups<TGroup> | undefined {
  if (!current || previousGroupId === nextGroupId) {
    return current;
  }

  return {
    groups: current.groups.map((group) => {
      if (group._count?.services === undefined) {
        return group;
      }

      let nextCount = group._count.services;
      if (previousGroupId && group.id === previousGroupId) {
        nextCount -= 1;
      }
      if (nextGroupId && group.id === nextGroupId) {
        nextCount += 1;
      }

      if (nextCount === group._count.services) {
        return group;
      }

      return {
        ...group,
        _count: {
          ...group._count,
          services: Math.max(0, nextCount),
        },
      };
    }),
  };
}
