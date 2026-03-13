import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const UI_ROOTS = [
  join(process.cwd(), 'src', 'app'),
  join(process.cwd(), 'src', 'components'),
];

const ALLOWED_SHADES: Record<string, Set<string>> = {
  primary: new Set(['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']),
  gray: new Set(['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']),
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return walk(fullPath);
    }

    if (!/\.(tsx|ts|css)$/.test(fullPath)) {
      return [];
    }

    const relPath = relative(process.cwd(), fullPath).replace(/\\/g, '/');
    if (relPath.includes('/api/') || relPath.includes('__tests__')) {
      return [];
    }

    return [fullPath];
  });
}

describe('theme custom shade audit', () => {
  it('does not use undefined custom primary or gray shades anywhere in app source', () => {
    const offenders: string[] = [];
    const tokenRegex = /\b(primary|gray)-(\d{2,3})\b/g;

    for (const root of UI_ROOTS) {
      for (const filePath of walk(root)) {
        const source = readFileSync(filePath, 'utf8');
        const relPath = relative(process.cwd(), filePath).replace(/\\/g, '/');

        for (const match of source.matchAll(tokenRegex)) {
          const [, color, shade] = match;
          if (!ALLOWED_SHADES[color]?.has(shade)) {
            offenders.push(`${relPath}:${color}-${shade}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
