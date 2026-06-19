import fs from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const iphoneScreenshotDir = path.resolve(
  process.cwd(),
  'apps/clientific-ios/metadata/en-US/images/iphone_65',
);

const ipadScreenshotDir = path.resolve(
  process.cwd(),
  'apps/clientific-ios/metadata/en-US/images/ipad_13',
);

const expectedScreenshots = [
  '01-ai-receptionist.png',
  '02-online-booking.png',
  '03-owner-alerts.png',
  '04-staff-scheduling.png',
  '05-customer-crm.png',
  '06-check-ins.png',
  '07-all-in-one.png',
  '08-growth-tools.png',
];

describe('iOS App Store screenshot assets', () => {
  it('ships the complete 6.5-inch screenshot set at the App Store required size', async () => {
    const files = fs
      .readdirSync(iphoneScreenshotDir)
      .filter((file) => file.endsWith('.png'))
      .sort();

    expect(files).toEqual(expectedScreenshots);

    for (const file of expectedScreenshots) {
      const filePath = path.join(iphoneScreenshotDir, file);
      const metadata = await sharp(filePath).metadata();
      const stats = fs.statSync(filePath);

      expect(metadata.width, file).toBe(1284);
      expect(metadata.height, file).toBe(2778);
      expect(stats.size, file).toBeGreaterThan(500_000);
      expect(stats.size, file).toBeLessThan(10_000_000);
    }
  });

  it('ships a clean 13-inch iPad screenshot at the App Store required size', async () => {
    const filePath = path.join(ipadScreenshotDir, '01-ipad-check-in.png');
    const metadata = await sharp(filePath).metadata();
    const stats = fs.statSync(filePath);

    expect(metadata.width).toBe(2048);
    expect(metadata.height).toBe(2732);
    expect(stats.size).toBeGreaterThan(500_000);
    expect(stats.size).toBeLessThan(10_000_000);
  });

  it('does not include the local development badge in the iPad screenshot', async () => {
    const filePath = path.join(ipadScreenshotDir, '01-ipad-check-in.png');
    const image = sharp(filePath).ensureAlpha();
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    const bottomStartY = Math.floor(info.height * 0.85);
    const leftEndX = Math.floor(info.width * 0.15);
    let darkPixelCount = 0;

    for (let y = bottomStartY; y < info.height; y += 1) {
      for (let x = 0; x < leftEndX; x += 1) {
        const index = (y * info.width + x) * info.channels;
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        const alpha = data[index + 3];
        const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;

        if (alpha > 200 && luminance < 100) {
          darkPixelCount += 1;
        }
      }
    }

    expect(darkPixelCount).toBe(0);
  });
});
