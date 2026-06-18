// @ts-nocheck -- This Jest-only smoke test reads checked-in config files from Node.
const fs = require('fs');
const path = require('path');

describe('iPad support configuration', () => {
  const projectRoot = path.resolve(__dirname, '..', '..');

  it('targets iPad in both Expo config and the checked-in native iOS project', () => {
    const appConfigPath = path.join(projectRoot, 'app.json');
    const appConfig = JSON.parse(fs.readFileSync(appConfigPath, 'utf8')) as {
      expo?: {
        ios?: {
          supportsTablet?: boolean;
        };
      };
    };

    expect(appConfig.expo?.ios?.supportsTablet).toBe(true);

    const projectFile = fs.readFileSync(
      path.join(projectRoot, 'ios', 'Clientific.xcodeproj', 'project.pbxproj'),
      'utf8',
    );

    expect(projectFile).not.toContain('TARGETED_DEVICE_FAMILY = 1;');
    expect(projectFile.match(/TARGETED_DEVICE_FAMILY = "1,2";/g)).toHaveLength(2);
  });
});
