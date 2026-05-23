const DEFAULT_USER_TEXT_MAX_LENGTH = 4_000;

const FIELD_LENGTH_LIMITS: Record<string, number> = {
  about: 2_000,
  accountHolderName: 240,
  answer: 2_000,
  bankName: 240,
  businessEmail: 320,
  businessName: 240,
  businessType: 120,
  callerPhone: 80,
  city: 120,
  country: 120,
  customerEmail: 320,
  customerName: 240,
  customerPhone: 80,
  description: 2_000,
  email: 320,
  errorMessage: 1_000,
  facebookPageUrl: 2_048,
  fromPhone: 80,
  fullName: 240,
  googleReviewUrl: 2_048,
  instagramUrl: 2_048,
  label: 120,
  lastInboundText: 2_000,
  lastIntent: 240,
  lastOutboundText: 2_000,
  link: 2_048,
  logoUrl: 2_048,
  message: 4_000,
  messageBody: 4_000,
  name: 240,
  notes: 4_000,
  phone: 80,
  publicProfileAbout: 2_000,
  publicProfileHeadline: 240,
  question: 1_000,
  requestedStaffName: 240,
  serviceName: 240,
  state: 120,
  street: 240,
  title: 240,
  toPhone: 80,
  transferFailureReason: 1_000,
  yelpUrl: 2_048,
  zipCode: 40,
};

const USER_TEXT_FIELDS = new Set(Object.keys(FIELD_LENGTH_LIMITS));

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function toWellFormedUnicode(value: string) {
  if (typeof value.toWellFormed === 'function') {
    return value.toWellFormed();
  }

  let result = '';

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        result += value[index] + value[index + 1];
        index += 1;
      } else {
        result += '\uFFFD';
      }
      continue;
    }

    if (code >= 0xdc00 && code <= 0xdfff) {
      result += '\uFFFD';
      continue;
    }

    result += value[index];
  }

  return result;
}

function truncateByCodePoint(value: string, maxLength: number) {
  const codePoints = Array.from(value);
  return codePoints.length > maxLength ? codePoints.slice(0, maxLength).join('') : value;
}

export function sanitizeUserTextForStorage(
  value: string,
  { maxLength = DEFAULT_USER_TEXT_MAX_LENGTH }: { maxLength?: number } = {},
) {
  return truncateByCodePoint(
    toWellFormedUnicode(value)
      .normalize('NFC')
      // PostgreSQL text cannot store NUL bytes. Other C0/C1 controls are invisible foot-guns.
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, ''),
    maxLength,
  );
}

function sanitizePotentialUserTextField(key: string, value: unknown): unknown {
  if (!USER_TEXT_FIELDS.has(key)) {
    return value;
  }

  return sanitizeStringsForUserTextField(
    value,
    FIELD_LENGTH_LIMITS[key] ?? DEFAULT_USER_TEXT_MAX_LENGTH,
  );
}

function sanitizeStringsForUserTextField(value: unknown, maxLength: number): unknown {
  if (typeof value === 'string') {
    return sanitizeUserTextForStorage(value, { maxLength });
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeStringsForUserTextField(item, maxLength));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        sanitizeStringsForUserTextField(nestedValue, maxLength),
      ]),
    );
  }

  return value;
}

export function sanitizeUserTextFieldsForStorage<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUserTextFieldsForStorage(item)) as T;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const sanitized: PlainObject = {};

  for (const [key, rawValue] of Object.entries(value)) {
    const fieldSanitizedValue = sanitizePotentialUserTextField(key, rawValue);

    sanitized[key] =
      fieldSanitizedValue === rawValue
        ? sanitizeUserTextFieldsForStorage(rawValue)
        : fieldSanitizedValue;
  }

  return sanitized as T;
}
