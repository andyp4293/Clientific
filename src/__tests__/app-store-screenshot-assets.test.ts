import fs from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const screenshotDir = path.resolve(
  process.cwd(),
  'apps/clientific-ios/metadata/en-US/images/iphone_65',
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
      .readdirSync(screenshotDir)
      .filter((file) => file.endsWith('.png'))
      .sort();

    expect(files).toEqual(expectedScreenshots);

    for (const file of expectedScreenshots) {
      const filePath = path.join(screenshotDir, file);
      const metadata = await sharp(filePath).metadata();
      const stats = fs.statSync(filePath);

      expect(metadata.width, file).toBe(1284);
      expect(metadata.height, file).toBe(2778);
      expect(stats.size, file).toBeGreaterThan(500_000);
      expect(stats.size, file).toBeLessThan(10_000_000);
    }
  });
});
