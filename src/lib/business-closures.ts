export type BusinessClosureDateValue = {
  date: string;
  label?: string | null;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidBusinessClosureDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;

  return parsed.toISOString().slice(0, 10) === value;
}

export function normalizeBusinessClosureLabel(label: string | null | undefined): string | null {
  if (typeof label !== 'string') return null;

  const trimmed = label.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed.slice(0, 80) : null;
}

export function normalizeBusinessClosureDates(
  closures: unknown
): BusinessClosureDateValue[] {
  if (!Array.isArray(closures)) return [];

  const uniqueByDate = new Map<string, BusinessClosureDateValue>();

  for (const closure of closures) {
    if (!closure || typeof closure !== 'object') continue;

    const value = closure as Record<string, unknown>;
    const date = typeof value.date === 'string' ? value.date : '';
    if (!isValidBusinessClosureDate(date)) continue;

    uniqueByDate.set(date, {
      date,
      label: normalizeBusinessClosureLabel(
        typeof value.label === 'string' ? value.label : null
      ),
    });
  }

  return Array.from(uniqueByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function findBusinessClosureForDate(
  date: string,
  closures: BusinessClosureDateValue[] | null | undefined
): BusinessClosureDateValue | null {
  if (!closures?.length) return null;
  return closures.find((closure) => closure.date === date) ?? null;
}

export function describeBusinessClosure(
  closure: BusinessClosureDateValue | null | undefined
): string {
  if (!closure) return 'Business is closed on this date.';
  if (closure.label) return `Business is closed for ${closure.label}.`;
  return 'Business is closed on this date.';
}
