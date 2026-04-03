import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import {
  getExpoProjectId,
  registerForPushNotificationsAsync,
} from '@/lib/mobile-push-notifications';

describe('mobile push notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Device as typeof Device & { __setIsDevice: (value: boolean) => void }).__setIsDevice(true);
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'granted' } as never);
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({ status: 'granted' } as never);
    jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({
      data: 'ExponentPushToken[test-token]',
    } as never);
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

  it('skips registration on simulators', async () => {
    (Device as typeof Device & { __setIsDevice: (value: boolean) => void }).__setIsDevice(false);

    const registration = await registerForPushNotificationsAsync();

    expect(registration).toBeNull();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('returns null when notification permission is denied', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'denied' } as never);
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({
      status: 'denied',
    } as never);

    const registration = await registerForPushNotificationsAsync();

    expect(registration).toBeNull();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });
});
