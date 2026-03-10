export interface GroupableService {
  id: string;
  name: string;
  sortOrder?: number | null;
  groupId?: string | null;
}

export interface ServiceGroupItem {
  id: string;
  name: string;
  sortOrder?: number | null;
}

export interface GroupedServiceSection<TService extends GroupableService = GroupableService> {
  group: ServiceGroupItem;
  services: TService[];
}

function safeSortOrder(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function sortServices<TService extends GroupableService>(services: TService[]): TService[] {
  return [...services].sort((a, b) => {
    const bySortOrder = safeSortOrder(a.sortOrder) - safeSortOrder(b.sortOrder);
    if (bySortOrder !== 0) return bySortOrder;
    return a.name.localeCompare(b.name);
  });
}

export function groupServicesForDisplay<TService extends GroupableService>(
  services: TService[],
  groups: ServiceGroupItem[]
): {
  hasGroups: boolean;
  flatServices: TService[];
  groupedSections: GroupedServiceSection<TService>[];
  ungroupedServices: TService[];
} {
  const sortedServices = sortServices(services);
  const sortedGroups = [...groups].sort((a, b) => {
    const bySortOrder = safeSortOrder(a.sortOrder) - safeSortOrder(b.sortOrder);
    if (bySortOrder !== 0) return bySortOrder;
    return a.name.localeCompare(b.name);
  });
  const hasGroups = sortedGroups.length > 0;

  if (!hasGroups) {
    return {
      hasGroups: false,
      flatServices: sortedServices,
      groupedSections: [],
      ungroupedServices: [],
    };
  }

  const groupedSections: GroupedServiceSection<TService>[] = sortedGroups.map((group) => ({
    group,
    services: sortedServices.filter((service) => service.groupId === group.id),
  }));

  const ungroupedServices = sortedServices.filter((service) => !service.groupId);

  return {
    hasGroups: true,
    flatServices: [],
    groupedSections,
    ungroupedServices,
  };
}
