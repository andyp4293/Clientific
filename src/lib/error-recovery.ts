export const RECOVERABLE_ERROR_RETRY_STORAGE_KEY =
  "clientific:recoverable-navigation-error-at";
export const RECOVERABLE_ERROR_RETRY_COOLDOWN_MS = 15_000;

const RECOVERABLE_NAVIGATION_ERROR_PATTERNS = [
  "chunkloaderror",
  "loading chunk",
  "failed to fetch dynamically imported module",
  "importing a module script failed",
  "failed to load module script",
];

function normalizeRecoverableErrorText(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "";
  }

  const name =
    "name" in error && typeof error.name === "string" ? error.name : "";
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";

  return `${name} ${message}`.trim().toLowerCase();
}

export function isRecoverableNavigationError(error: unknown): boolean {
  const normalized = normalizeRecoverableErrorText(error);
  if (!normalized) {
    return false;
  }

  return RECOVERABLE_NAVIGATION_ERROR_PATTERNS.some((pattern) =>
    normalized.includes(pattern),
  );
}

export function maybeRecoverFromNavigationError(
  error: unknown,
  {
    storage,
    reload,
    now = Date.now(),
  }: {
    storage: Pick<Storage, "getItem" | "setItem">;
    reload: () => void;
    now?: number;
  },
): boolean {
  if (!isRecoverableNavigationError(error)) {
    return false;
  }

  try {
    const lastAttemptRaw = storage.getItem(
      RECOVERABLE_ERROR_RETRY_STORAGE_KEY,
    );
    const lastAttempt =
      typeof lastAttemptRaw === "string" && lastAttemptRaw.trim().length > 0
        ? Number(lastAttemptRaw)
        : Number.NaN;

    if (
      Number.isFinite(lastAttempt) &&
      now - lastAttempt < RECOVERABLE_ERROR_RETRY_COOLDOWN_MS
    ) {
      return false;
    }

    storage.setItem(RECOVERABLE_ERROR_RETRY_STORAGE_KEY, String(now));
  } catch {
    // Best effort only; if storage is unavailable, still try a one-time refresh.
  }

  reload();
  return true;
}
