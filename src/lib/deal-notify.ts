export const DEAL_NOTIFY_COOLDOWN_DAYS = 3;
export const DEAL_NOTIFY_COOLDOWN_MS = DEAL_NOTIFY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export function getDealNotifyCooldownRemainingMs(
  notifiedAt: string | Date | null | undefined,
  nowMs = Date.now()
): number {
  if (!notifiedAt) return 0;

  const notifiedAtMs =
    notifiedAt instanceof Date ? notifiedAt.getTime() : new Date(notifiedAt).getTime();

  if (Number.isNaN(notifiedAtMs)) return 0;

  return Math.max(notifiedAtMs + DEAL_NOTIFY_COOLDOWN_MS - nowMs, 0);
}
