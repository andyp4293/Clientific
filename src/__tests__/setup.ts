import { loadEnvFile } from "node:process";
import "@testing-library/jest-dom";
import { vi } from "vitest";

// Load local app env files for tests that import modules using Prisma at module scope.
for (const envFile of [".env", ".env.local"]) {
  try {
    loadEnvFile(envFile);
  } catch {
    // Missing env files are fine in CI or stripped test environments.
  }
}

// Mock next/cache globally — unstable_cache and revalidateTag are used in
// production code but have no meaning in a Node test environment.
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: () => unknown) => fn),
}));
