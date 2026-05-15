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
      'className="fixed inset-0 z-[70] bg-black/50 p-0 sm:flex sm:items-center sm:justify-center sm:p-4"',
    );
    expect(source).toContain(
      "flex h-[100dvh] min-h-[100dvh] w-full flex-col bg-white shadow-2xl dark:bg-gray-800",
    );
    expect(source).toContain("sm:max-w-5xl sm:rounded-xl sm:border");
    expect(source).toContain("flex-1 space-y-4 overflow-y-auto px-4 py-4");
    expect(source).toContain("grid grid-cols-1 gap-4 lg:grid-cols-2");
    expect(source).toContain('className="space-y-4 lg:contents"');
    expect(source).toContain("lg:col-span-2");
    expect(source).toContain("grid grid-cols-1 gap-4 sm:grid-cols-2");
    expect(source).toContain("pt-[calc(env(safe-area-inset-top)+1rem)]");
    expect(source).toContain("pb-[calc(env(safe-area-inset-bottom)+1rem)]");
    expect(source).toContain(
      "flex flex-col-reverse gap-3 border-t border-gray-100 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]",
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
    expect(source).toContain("grid grid-cols-1 gap-4 md:grid-cols-2");
    expect(source).not.toContain(
      "Set working days, bookable services, and appointment hours",
    );
    expect(source).not.toContain("Who will customers see?");
    expect(source).not.toContain(
      "Add the core details used across bookings, reminders,",
    );
    expect(source).not.toContain(
      "Keep this enabled when this staff member should appear",
    );
    expect(source).not.toContain(
      "member.workDays && member.workDays.length < 7 &&",
    );
    expect(source).not.toContain("formatStaffAvailabilitySummary({");
    expect(source).toContain("DAY_LABELS.map((label, i) => (");
  });

  it("renders service rows with a responsive card layout that preserves title space on mobile", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain(
      'className="rounded-2xl border border-gray-200/90 bg-white/70 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40 sm:p-5"',
    );
    expect(source).toContain(
      'className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"',
    );
    expect(source).toContain(
      'className="min-w-0 flex-1 text-base font-semibold leading-6 text-gray-900 dark:text-gray-100 sm:text-lg sm:leading-7 break-words"',
    );
    expect(source).toContain(
      'className="mt-3 flex flex-wrap gap-2"',
    );
    expect(source).toContain(
      'className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[20rem] lg:flex-none"',
    );
  });

  it("includes owner-managed employee app access with privacy copy", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain("Employee app access");
    expect(source).toContain("Appointment-only login");
    expect(source).toContain("portalAccessEnabled");
    expect(source).toContain("Temporary password email");
    expect(source).toContain("must create their own password");
    expect(source).toContain("Customer phones stay hidden");
    expect(source).toMatch(/CRM,\s+deals,\s+billing,\s+and settings stay hidden/);
    expect(source).toContain("Employee app enabled");
    expect(source).toContain("Employee app off");
  });
});
