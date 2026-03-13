import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const UI_ROOTS = [
  join(process.cwd(), 'src', 'app'),
  join(process.cwd(), 'src', 'components'),
];

const EXCLUDED_FILES = new Set([
  'src/components/layout/nav-icons.tsx',
]);

const RAW_THEME_TOKENS = [
  'bg-white',
  'bg-gray-50',
  'bg-gray-100',
  'border-gray-200',
  'border-gray-300',
  'text-gray-900',
  'text-gray-800',
  'text-gray-700',
  'text-gray-600',
  'text-gray-500',
];

const SHARED_THEME_HELPERS = [
  'brand-shell',
  'brand-panel',
  'brand-hero',
  'card',
  'input',
  'btn-primary',
  'btn-secondary',
  'btn-outline',
  'label',
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return walk(fullPath);
    }

    if (!fullPath.endsWith('.tsx')) {
      return [];
    }

    const relPath = relative(process.cwd(), fullPath).replace(/\\/g, '/');
    if (relPath.includes('/api/') || relPath.includes('__tests__') || relPath.includes('.test.')) {
      return [];
    }
    if (EXCLUDED_FILES.has(relPath)) {
      return [];
    }

    return [fullPath];
  });
}

describe('theme dark mode audit', () => {
  it('does not leave any UI file with only light-theme raw tokens', () => {
    const offenders: string[] = [];

    for (const root of UI_ROOTS) {
      for (const filePath of walk(root)) {
        const source = readFileSync(filePath, 'utf8');
        const relPath = relative(process.cwd(), filePath).replace(/\\/g, '/');

        const usesRawThemeTokens = RAW_THEME_TOKENS.some((token) => source.includes(token));
        if (!usesRawThemeTokens) {
          continue;
        }

        const hasDarkSupport = source.includes('dark:');
        const usesSharedThemeHelper = SHARED_THEME_HELPERS.some((helper) => source.includes(helper));

        if (!hasDarkSupport && !usesSharedThemeHelper) {
          offenders.push(relPath);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
