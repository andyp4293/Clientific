export function sanitizeExternalHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function validateOptionalExternalHttpUrl(
  value: unknown,
  fieldLabel: string
): { value: string | null; error: string | null } {
  if (value === undefined) {
    return { value: null, error: null };
  }

  if (typeof value !== 'string') {
    return { value: null, error: `${fieldLabel} must be a valid http or https URL.` };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { value: null, error: null };
  }

  const sanitized = sanitizeExternalHttpUrl(trimmed);
  if (!sanitized) {
    return { value: null, error: `${fieldLabel} must be a valid http or https URL.` };
  }

  return { value: sanitized, error: null };
}
