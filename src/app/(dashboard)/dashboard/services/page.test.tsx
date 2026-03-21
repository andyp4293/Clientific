import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('services page cache sync contract', () => {
  it('updates the shared services cache directly for service create and delete flows', () => {
    const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
    const servicesInvalidations = source.match(/invalidateQueries\(\{ queryKey: \['services'\] \}\)/g) ?? [];

    const normalized = source.replace(/\r\n/g, '\n');
    expect(normalized).toContain('upsertServicesQueryData');
    expect(normalized).toContain('removeServiceFromQueryData');
    expect(normalized).toContain("queryClient.setQueryData(\n        ['services']");
    expect(servicesInvalidations).toHaveLength(2);
  });

  it('renders service and staff dialogs as full-screen flows on mobile while preserving desktop dialogs', () => {
    const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

    expect(source).toContain('data-mobile-overlay="true" className="fixed inset-0 z-[70] bg-black/50 p-0 sm:flex sm:items-center sm:justify-center sm:p-4"');
    expect(source).toContain('flex h-[100dvh] w-full flex-col bg-white shadow-2xl dark:bg-gray-800 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-xl');
    expect(source).toContain('grid grid-cols-1 gap-4 sm:grid-cols-2');
    expect(source).toContain('pt-[calc(env(safe-area-inset-top)+1rem)]');
    expect(source).toContain('pb-[calc(env(safe-area-inset-bottom)+1rem)]');
    expect(source).toContain('flex flex-col-reverse gap-3 border-t border-gray-100 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] dark:border-gray-700 sm:flex-row sm:border-t-0 sm:px-6 sm:pb-6 sm:pt-2');
    expect(source).toContain('Working Hours');
    expect(source).toContain('Staff hours are set per day below and always stay inside the business hours.');
  });
});
