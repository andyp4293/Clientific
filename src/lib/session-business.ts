import type { Session } from 'next-auth';

type SessionUserLike = {
  id?: string | null;
  businessId?: string | null;
} | null | undefined;

function normalizeId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getSessionBusinessId(
  session: Session | null | undefined
): string | null {
  const user = session?.user as SessionUserLike;
  if (!user) return null;

  return normalizeId(user.businessId) ?? normalizeId(user.id);
}

