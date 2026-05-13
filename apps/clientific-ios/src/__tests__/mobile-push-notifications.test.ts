import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import {
  getMobilePushPermissionStatus,
  getExpoProjectId,
  mobileNotificationHandler,
  normalizeMobileAppBadgeCount,
  registerForPushNotificationsAsync,
  syncMobileAppBadgeCount,
} from '@/lib/mobile-push-notifications';

describe('mobile push notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Device as typeof Device & { __setIsDevice: (value: boolean) => void }).__setIsDevice(true);
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: true,
      status: 'granted',
    } as never);
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({
      granted: true,
      status: 'granted',
    } as never);
    jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({
      data: 'ExponentPushToken[test-token]',
    } as never);
    jest.mocked(Notifications.setBadgeCountAsync).mockResolvedValue(true as never);
  });

  it('shows foreground push alerts with sound and updates the app icon badge', async () => {
    await expect(mobileNotificationHandler.handleNotification()).resolves.toMatchObject({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    });
  });

  it('reads the Expo project id from app config', () => {
    expect(getExpoProjectId()).toBe('project-123');
  });

  it('returns a push registration for physical devices with granted permissions', async () => {
    const registration = await registerForPushNotificationsAsync();

    expect(registration).toEqual({
      token: 'ExponentPushToken[test-token]',
      platform: 'ios',
      appIdentifier: 'app.clientific.mobile',
      deviceName: 'iPhone 17 Pro',
    });
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: 'project-123',
    });
  });

  it('requests iOS alert, sound, badge, and settings permissions before registering', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: false,
      status: 'undetermined',
    } as never);

    await registerForPushNotificationsAsync();

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledWith({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        provideAppNotificationSettings: true,
      },
    });
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: 'project-123',
    });
  });

  it('requests notification permission on simulators but skips Expo push token registration', async () => {
    (Device as typeof Device & { __setIsDevice: (value: boolean) => void }).__setIsDevice(false);
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: false,
      status: 'undetermined',
    } as never);

    const registration = await registerForPushNotificationsAsync();

    expect(registration).toBeNull();
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledWith({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        provideAppNotificationSettings: true,
      },
    });
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('returns null when notification permission is denied', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: false,
      status: 'denied',
    } as never);
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({
      granted: false,
      status: 'denied',
    } as never);

    const registration = await registerForPushNotificationsAsync();

    expect(registration).toBeNull();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('reports the current notification permission status', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: false,
      status: 'undetermined',
    } as never);

    await expect(getMobilePushPermissionStatus()).resolves.toBe('undetermined');
  });

  it('normalizes and syncs app icon badge counts', async () => {
    expect(normalizeMobileAppBadgeCount(3.8)).toBe(3);
    expect(normalizeMobileAppBadgeCount(-2)).toBe(0);
    expect(normalizeMobileAppBadgeCount(Number.NaN)).toBe(0);

    await expect(syncMobileAppBadgeCount(5)).resolves.toBe(true);

    expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(5);
  });
});
