import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("services page cache sync contract", () => {
  it("updates the shared services cache directly for service create and delete flows", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    const servicesInvalidations =
      source.match(/invalidateQueries\(\{ queryKey: \["services"\] \}\)/g) ??
      [];

    const normalized = source.replace(/\r\n/g, "\n");
    expect(normalized).toContain("upsertServicesQueryData");
    expect(normalized).toContain("removeServiceFromQueryData");
    expect(normalized).toMatch(
      /queryClient\.setQueryData\(\s*\[\s*["']services["']\s*\]/,
    );
    expect(servicesInvalidations).toHaveLength(2);
  });

  it("renders service and staff dialogs as full-screen flows on mobile while preserving desktop dialogs", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain('data-mobile-overlay="true"');
    expect(source).toContain(
      'className="fixed inset-0 z-[70] bg-black/50 p-0 sm:flex sm:items-center sm:justify-center sm:p-4"',
    );
    expect(source).toContain(
      "flex h-[100dvh] w-full flex-col bg-white shadow-2xl dark:bg-gray-800 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-xl",
    );
    expect(source).toContain(
      "fixed inset-0 z-[70] overflow-hidden overscroll-none bg-[rgb(var(--color-gray-50))] dark:bg-[rgb(var(--color-gray-950))]",
    );
    expect(source).toContain(
      "flex h-[100dvh] min-h-[100dvh] w-screen max-w-none flex-col overflow-hidden bg-white shadow-2xl dark:bg-gray-900",
    );
    expect(source).toContain("sm:max-w-4xl lg:max-w-6xl");
    expect(source).toContain(
      "grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-6",
    );
    expect(source).toContain("grid grid-cols-1 gap-4 sm:grid-cols-2");
    expect(source).toContain("pt-[calc(env(safe-area-inset-top)+1rem)]");
    expect(source).toContain("pb-[calc(env(safe-area-inset-bottom)+1rem)]");
    expect(source).toContain(
      "flex flex-col-reverse gap-3 border-t border-gray-200/80 bg-white/95 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur",
    );
    expect(source).toContain("Working hours");
    expect(source).toContain("Times shown in {businessTimezoneLabel}");
    expect(source).toMatch(
      /formatScheduleTimeRange\(\s*businessDay\.openTime,\s*businessDay\.closeTime,\s*\)/,
    );
    expect(source).toContain("formatScheduleTimeLabel(timeValue)");
    expect(source).toContain(
      "Staff hours are set per day below, stay inside business",
    );
    expect(source).toContain("grid grid-cols-1 gap-4 2xl:grid-cols-2");
  });
});
