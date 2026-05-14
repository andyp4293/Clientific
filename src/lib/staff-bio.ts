export const STAFF_BIO_MAX_LENGTH = 500;

export function normalizeStaffBio(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getStaffBioValidationError(value: unknown) {
  const normalized = normalizeStaffBio(value);

  if (normalized && normalized.length > STAFF_BIO_MAX_LENGTH) {
    return `Staff bio must be ${STAFF_BIO_MAX_LENGTH} characters or fewer.`;
  }

  return null;
}
