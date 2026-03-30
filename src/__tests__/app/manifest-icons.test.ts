import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type ManifestIcon = {
  src: string;
  sizes: string;
};

function readPngDimensions(relativePath: string) {
  const file = readFileSync(join(process.cwd(), 'public', relativePath));

  if (file.length < 24 || file.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error(`Invalid PNG header for ${relativePath}`);
  }

  return {
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20),
  };
}

describe('manifest icons', () => {
  it('declares icon sizes that match the actual PNG files', () => {
    const manifest = JSON.parse(readFileSync(join(process.cwd(), 'public', 'manifest.json'), 'utf8')) as {
      icons: ManifestIcon[];
    };

    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: '/icon-192.png', sizes: '192x192' }),
        expect.objectContaining({ src: '/icon-512.png', sizes: '512x512' }),
      ])
    );

    for (const icon of manifest.icons) {
      const [width, height] = icon.sizes.split('x').map(Number);
      const dimensions = readPngDimensions(icon.src.replace(/^\//, ''));

      expect(dimensions).toEqual({ width, height });
    }
  });
});
