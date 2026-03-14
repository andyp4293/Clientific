import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const UI_ROOTS = [
  join(process.cwd(), 'src', 'app'),
  join(process.cwd(), 'src', 'components'),
];

const SURFACE_HELPERS = ['card', 'brand-panel', 'brand-shell', 'input'];
const LIGHT_BG_TOKENS = ['bg-white', 'bg-gray-50', 'bg-gray-100', 'bg-primary-50'];

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

    return [fullPath];
  });
}

describe('theme helper override audit', () => {
  it('does not override shared themed surfaces with light-only backgrounds', () => {
    const offenders: string[] = [];
    const classRegex = /className\s*=\s*(?:"([^"]*)"|`([^`]*)`|\{\s*`([^`]*)`\s*\})/g;

    for (const root of UI_ROOTS) {
      for (const filePath of walk(root)) {
        const source = readFileSync(filePath, 'utf8');
        const relPath = relative(process.cwd(), filePath).replace(/\\/g, '/');

        for (const match of source.matchAll(classRegex)) {
          const classValue = match[1] || match[2] || match[3] || '';
          const usesSurfaceHelper = SURFACE_HELPERS.some((helper) => classValue.includes(helper));
          const usesLightOverride = LIGHT_BG_TOKENS.some((token) => classValue.includes(token));

          if (usesSurfaceHelper && usesLightOverride && !classValue.includes('dark:bg-')) {
            offenders.push(relPath);
            break;
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
