import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function collectPageFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectPageFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name === 'page.tsx') {
      files.push(fullPath);
    }
  }

  return files;
}

describe('App page contracts', () => {
  it('uses async Promise typing for searchParams in page.tsx files', () => {
    const appDir = path.join(process.cwd(), 'src', 'app');
    const pageFiles = collectPageFiles(appDir);

    const offenders = pageFiles
      .filter((filePath) => {
        const content = fs.readFileSync(filePath, 'utf8');
        return content.includes('searchParams') && /searchParams\s*:\s*\{/.test(content);
      })
      .map((filePath) => path.relative(process.cwd(), filePath).replace(/\\/g, '/'));

    expect(offenders).toEqual([]);
  });
});
