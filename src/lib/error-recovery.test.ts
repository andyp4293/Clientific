import { describe, expect, it, vi } from "vitest";

import {
  RECOVERABLE_ERROR_RETRY_COOLDOWN_MS,
  RECOVERABLE_ERROR_RETRY_STORAGE_KEY,
  isRecoverableNavigationError,
  maybeRecoverFromNavigationError,
} from "@/lib/error-recovery";

function createStorage(initialValue?: string | null) {
  let storedValue = initialValue ?? null;

  return {
    getItem: vi.fn((key: string) =>
      key === RECOVERABLE_ERROR_RETRY_STORAGE_KEY ? storedValue : null,
    ),
    setItem: vi.fn((key: string, value: string) => {
      if (key === RECOVERABLE_ERROR_RETRY_STORAGE_KEY) {
        storedValue = value;
      }
    }),
  };
}

describe("error recovery", () => {
  it("detects chunk load errors from route navigation", () => {
    expect(
      isRecoverableNavigationError(
        new Error("Failed to fetch dynamically imported module"),
      ),
    ).toBe(true);
    expect(
      isRecoverableNavigationError({
        name: "ChunkLoadError",
        message: "Loading chunk app/(dashboard)/dashboard/checkins/page failed",
      }),
    ).toBe(true);
    expect(isRecoverableNavigationError(new Error("Database is unavailable"))).toBe(
      false,
    );
  });

  it("reloads once for a recoverable navigation error and records the attempt", () => {
    const reload = vi.fn();
    const storage = createStorage();

    const didRecover = maybeRecoverFromNavigationError(
      new Error("Failed to fetch dynamically imported module"),
      {
        storage,
        reload,
        now: 1_000,
      },
    );

    expect(didRecover).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(
      RECOVERABLE_ERROR_RETRY_STORAGE_KEY,
      "1000",
    );
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not loop reloads inside the cooldown window", () => {
    const reload = vi.fn();
    const storage = createStorage("1000");

    const didRecover = maybeRecoverFromNavigationError(
      { name: "ChunkLoadError", message: "Loading chunk checkins failed" },
      {
        storage,
        reload,
        now: 1_000 + RECOVERABLE_ERROR_RETRY_COOLDOWN_MS - 1,
      },
    );

    expect(didRecover).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
