import { hashPassword } from '@/lib/utils';

export const STAFF_PORTAL_PASSWORD_MIN_LENGTH = 8;

type ExistingStaffPortalAccess = {
  email: string | null;
  portalAccessEnabled: boolean;
  portalPasswordHash: string | null;
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

  if (isEnabling && !hasExistingPassword && !password) {
    return {
      error: 'Set a temporary employee app password before enabling access.',
    };
  }

  const data: {
    portalAccessEnabled?: boolean;
    portalPasswordHash?: string | null;
    portalPasswordSetAt?: Date | null;
  } = {};

  if (hasAccessFlag || isCreate) {
    data.portalAccessEnabled = Boolean(nextAccessEnabled);
  }

  if (password) {
    data.portalPasswordHash = await hashPassword(password);
    data.portalPasswordSetAt = new Date();
  }

  if (hasAccessFlag && !nextAccessEnabled) {
    data.portalPasswordHash = null;
    data.portalPasswordSetAt = null;
  }

  return { data };
}
