import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const APP_ROOT = join(process.cwd(), 'src', 'app');
const PAGE_ENTRY_FILES = new Set(['page.tsx', 'layout.tsx', 'loading.tsx', 'error.tsx', 'not-found.tsx']);
const HARD_CODED_PAGE_SHELL_PATTERNS = [
  /className\s*=\s*["'`][^"'`]*min-h-screen[^"'`]*dark:bg-gray-900[^"'`]*["'`]/,
  /className\s*=\s*["'`][^"'`]*min-h-screen[^"'`]*dark:bg-gray-950[^"'`]*["'`]/,
  /className\s*=\s*["'`][^"'`]*min-h-screen[^"'`]*dark:from-gray-950[^"'`]*dark:to-gray-900[^"'`]*["'`]/,
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if (entry === 'api') {
        return [];
      }

      return walk(fullPath);
    }

    if (!PAGE_ENTRY_FILES.has(entry)) {
      return [];
    }

    return [fullPath];
  });
}

describe('page shell theme audit', () => {
  it('does not hardcode page-level dark backgrounds outside the shared shell classes', () => {
    const offenders: string[] = [];

    for (const filePath of walk(APP_ROOT)) {
      const source = readFileSync(filePath, 'utf8');
      const relPath = relative(process.cwd(), filePath).replace(/\\/g, '/');

      if (HARD_CODED_PAGE_SHELL_PATTERNS.some((pattern) => pattern.test(source))) {
        offenders.push(relPath);
      }
    }

    expect(offenders).toEqual([]);
  });
});
