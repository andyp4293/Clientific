import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const GLOBALS_CSS = join(process.cwd(), 'src', 'app', 'globals.css');

describe('branded surface theme helpers', () => {
  it('defines light and dark variants for shared branded hero helpers', () => {
    const source = readFileSync(GLOBALS_CSS, 'utf8');

    expect(source).toContain('.home-hero-shell {');
    expect(source).toContain('.dark .home-hero-shell {');
    expect(source).toContain('.home-hero-panel {');
    expect(source).toContain('.dark .home-hero-panel {');
    expect(source).toContain('.brand-hero {');
    expect(source).toContain('.dark .brand-hero {');
    expect(source).toContain('.brand-hero-card {');
    expect(source).toContain('.dark .brand-hero-card {');
  });
});
