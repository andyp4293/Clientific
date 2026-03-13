import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('theme centralization', () => {
  it('drives the shared palette from CSS variables consumed by Tailwind tokens', () => {
    const globals = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
    const tailwind = readFileSync(new URL('../../../tailwind.config.ts', import.meta.url), 'utf8');
    const businessPage = readFileSync(new URL('../../app/business/[publicId]/page.tsx', import.meta.url), 'utf8');

    expect(globals).toContain('--color-primary-600');
    expect(globals).toContain('--color-gray-900');
    expect(globals).toContain('--color-warning');
    expect(globals).toContain('.text-gray-400');
    expect(globals).toContain('.dark .dark\\:text-gray-400');
    expect(globals).toContain('.dark .dark\\:text-gray-600');
    expect(globals).toContain('.text-gray-600');

    expect(tailwind).toContain('const colorVar = (token: string) =>');
    expect(tailwind).toContain('DEFAULT: colorVar("--color-primary-600")');
    expect(tailwind).toContain('900: colorVar("--color-gray-900")');
    expect(tailwind).toContain('success: colorVar("--color-success")');
    expect(tailwind).not.toContain('DEFAULT: "#7B22D4"');

    expect(businessPage).toContain('from-gray-900 via-gray-800 to-primary-900');
    expect(businessPage).not.toContain('emerald-');
    expect(businessPage).not.toContain('slate-');
  });
});
