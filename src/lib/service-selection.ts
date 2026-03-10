interface SelectableService {
  id: string;
}

export function toggleServiceSelection<TService extends SelectableService>(
  currentSelection: TService[],
  service: TService
): TService[] {
  const alreadySelected = currentSelection.some((selected) => selected.id === service.id);
  if (alreadySelected) {
    return currentSelection.filter((selected) => selected.id !== service.id);
  }

  return [...currentSelection, service];
}
