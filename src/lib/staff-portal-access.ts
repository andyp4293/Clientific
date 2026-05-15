import { randomBytes } from 'crypto';
import { hashPassword } from '@/lib/utils';

export const STAFF_PORTAL_PASSWORD_MIN_LENGTH = 8;
const STAFF_TEMPORARY_PASSWORD_LENGTH = 14;
const STAFF_TEMPORARY_PASSWORD_CHARS =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';

type ExistingStaffPortalAccess = {
  email: string | null;
  portalAccessEnabled: boolean;
  portalPasswordHash: string | null;
  portalPasswordSetAt?: Date | null;
};

type StaffPortalAccessParams = {
  email: string | null | undefined;
  existing?: ExistingStaffPortalAccess | null;
  isCreate?: boolean;
  portalAccessEnabled?: unknown;
  portalPassword?: unknown;
};

export function normalizeStaffEmail(email: unknown) {
  return typeof email === 'string' && email.trim().length > 0
    ? email.trim().toLowerCase()
    : null;
}

export function hasStaffPortalPassword(staff: { portalPasswordHash?: string | null }) {
  return Boolean(staff.portalPasswordHash);
}

export function isStaffPasswordChangeRequired(staff: {
  portalAccessEnabled?: boolean | null;
  portalPasswordHash?: string | null;
  portalPasswordSetAt?: Date | string | null;
}) {
  return Boolean(
    staff.portalAccessEnabled &&
      staff.portalPasswordHash &&
      !staff.portalPasswordSetAt,
  );
}

export function generateStaffTemporaryPassword(length = STAFF_TEMPORARY_PASSWORD_LENGTH) {
  const bytes = randomBytes(length);
  let password = '';
  for (const byte of bytes) {
    password += STAFF_TEMPORARY_PASSWORD_CHARS[byte % STAFF_TEMPORARY_PASSWORD_CHARS.length];
  }
  return password;
}

export async function resolveStaffPasswordChangeData(newPassword: unknown): Promise<
  | {
      data: {
        portalPasswordHash: string;
        portalPasswordSetAt: Date;
      };
    }
  | { error: string }
> {
  const password =
    typeof newPassword === 'string' && newPassword.trim().length > 0
      ? newPassword.trim()
      : '';

  if (password.length < STAFF_PORTAL_PASSWORD_MIN_LENGTH) {
    return {
      error: `Employee app password must be at least ${STAFF_PORTAL_PASSWORD_MIN_LENGTH} characters.`,
    };
  }

  return {
    data: {
      portalPasswordHash: await hashPassword(password),
      portalPasswordSetAt: new Date(),
    },
  };
}

export async function resolveStaffPortalAccessData({
  email,
  existing = null,
  isCreate = false,
  portalAccessEnabled,
  portalPassword,
}: StaffPortalAccessParams): Promise<
  | {
      data: {
        portalAccessEnabled?: boolean;
        portalPasswordHash?: string | null;
        portalPasswordSetAt?: Date | null;
      };
      temporaryPassword?: string;
    }
  | { error: string }
> {
  const hasAccessFlag = typeof portalAccessEnabled === 'boolean';
  const nextAccessEnabled = hasAccessFlag
    ? Boolean(portalAccessEnabled)
    : isCreate
      ? false
      : existing?.portalAccessEnabled;
  const password =
    typeof portalPassword === 'string' && portalPassword.trim().length > 0
      ? portalPassword.trim()
      : '';
  const nextEmail = normalizeStaffEmail(email ?? existing?.email ?? null);
  const isEnabling = nextAccessEnabled === true;
  const hasExistingPassword = Boolean(existing?.portalPasswordHash);

  if (!hasAccessFlag && !password && !isCreate) {
    return { data: {} };
  }

  if (isEnabling && !nextEmail) {
    return { error: 'Add an email before enabling employee app access.' };
  }

  if (password && password.length < STAFF_PORTAL_PASSWORD_MIN_LENGTH) {
    return {
      error: `Employee app password must be at least ${STAFF_PORTAL_PASSWORD_MIN_LENGTH} characters.`,
    };
  }

  const data: {
    portalAccessEnabled?: boolean;
    portalPasswordHash?: string | null;
    portalPasswordSetAt?: Date | null;
  } = {};
  let temporaryPassword: string | undefined;

  if (hasAccessFlag || isCreate) {
    data.portalAccessEnabled = Boolean(nextAccessEnabled);
  }

  const passwordToHash =
    password || (isEnabling && !hasExistingPassword ? generateStaffTemporaryPassword() : '');

  if (passwordToHash) {
    temporaryPassword = passwordToHash;
    data.portalPasswordHash = await hashPassword(passwordToHash);
    data.portalPasswordSetAt = null;
  }

  if (hasAccessFlag && !nextAccessEnabled) {
    data.portalPasswordHash = null;
    data.portalPasswordSetAt = null;
  }

  return temporaryPassword ? { data, temporaryPassword } : { data };
}
