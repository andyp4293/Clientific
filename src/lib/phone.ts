const E164_PHONE_REGEX = /^\+[1-9]\d{9,14}$/;

function digitsOnly(phone: string | null | undefined): string {
  return typeof phone === 'string' ? phone.replace(/\D/g, '') : '';
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function buildPhoneLookupKey(phone: string | null | undefined): string | null {
  const digits = digitsOnly(phone);
  if (!digits) return null;

  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }

  if (digits.length === 10) {
    return digits;
  }

  return digits;
}

export function normalizePhoneNumber(phone: string): string {
  const trimmed = phone.trim();
  const digits = digitsOnly(trimmed);

  if (!digits) {
    return trimmed;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  return trimmed.startsWith('+') ? `+${digits}` : `+${digits}`;
}

export function isE164PhoneNumber(phone: string): boolean {
  if (!phone) return false;
  return E164_PHONE_REGEX.test(phone.trim());
}

export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  const digits = digitsOnly(phone);
  return digits.length >= 10 && digits.length <= 15;
}

export function normalizeOptionalPhoneNumber(phone: unknown): string | null {
  if (typeof phone !== 'string') return null;

  const trimmed = phone.trim();
  if (!trimmed) return null;
  if (!isValidPhoneNumber(trimmed)) return null;

  const normalized = normalizePhoneNumber(trimmed);
  return isE164PhoneNumber(normalized) ? normalized : null;
}

export function formatPhoneForDisplay(phone: string | null | undefined): string {
  if (typeof phone !== 'string') return '';

  const trimmed = phone.trim();
  if (!trimmed) return '';

  const lookupKey = buildPhoneLookupKey(trimmed);
  if (lookupKey && lookupKey.length === 10) {
    return `(${lookupKey.slice(0, 3)}) ${lookupKey.slice(3, 6)}-${lookupKey.slice(6)}`;
  }

  return trimmed;
}

export function buildCustomerPhoneMatchClauses(
  phone: string | null | undefined
): Array<{ phoneLookupKey?: string; phone?: string }> {
  if (typeof phone !== 'string' || phone.trim().length === 0) {
    return [];
  }

  const trimmed = phone.trim();
  const normalized = normalizeOptionalPhoneNumber(trimmed);
  const lookupKey = buildPhoneLookupKey(trimmed);
  const rawDigits = digitsOnly(trimmed);

  return uniqueStrings([normalized, trimmed, rawDigits]).reduce<
    Array<{ phoneLookupKey?: string; phone?: string }>
  >((clauses, value) => {
    clauses.push({ phone: value });
    return clauses;
  }, lookupKey ? [{ phoneLookupKey: lookupKey }] : []);
}

export function buildCustomerPhoneData(phone: string | null | undefined): {
  phone: string | null;
  phoneLookupKey: string | null;
} {
  return {
    phone: normalizeOptionalPhoneNumber(phone),
    phoneLookupKey: buildPhoneLookupKey(phone),
  };
}
