import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('appointments page mobile dialog contract', () => {
  it('keeps the long appointment dialogs full-screen on mobile and dialog-sized on desktop', () => {
    const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

    expect(source).toContain('fixed inset-0 z-[70] bg-black/50 p-0 sm:flex sm:items-center sm:justify-center sm:p-4');
    expect(source).toContain('flex h-[100dvh] w-full flex-col bg-white shadow-2xl dark:bg-gray-800 sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl');
    expect(source).toContain('fixed inset-0 z-[70] bg-black/40 p-0 sm:flex sm:items-center sm:justify-center sm:p-4');
    expect(source).toContain('flex h-[100dvh] w-full flex-col bg-white shadow-2xl dark:bg-gray-800 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-xl');
  });

  it('stacks appointment form content on mobile while preserving the desktop split layout', () => {
    const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

    expect(source).toContain('grid min-h-0 grid-cols-1 md:grid-cols-2');
    expect(source).toContain('space-y-5 border-b border-gray-100 p-4 dark:border-gray-700 md:border-b-0 md:border-r md:p-5');
    expect(source).toContain('grid grid-cols-1 gap-4 sm:grid-cols-2');
    expect(source).toContain('sticky bottom-0 -mx-4 flex flex-col-reverse gap-3 border-t border-gray-100 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-800 sm:mx-0 sm:flex-row sm:border-t-0 sm:px-0 sm:pb-0 sm:pt-2');
  });
});
