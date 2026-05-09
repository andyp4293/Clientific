import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type MobilePushRegistration =
  | {
      token: string;
      platform: string;
      appIdentifier: string | null;
      deviceName: string | null;
    }
  | null;

export type MobilePushPermissionStatus = 'granted' | 'denied' | 'undetermined';

export function getExpoProjectId() {
  const extraProjectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  const easProjectId = Constants.easConfig?.projectId;

  return extraProjectId ?? easProjectId ?? null;
}

export async function registerForPushNotificationsAsync(): Promise<MobilePushRegistration> {
  if (!Device.isDevice) {
    return null;
  }

  const permissions = await Notifications.getPermissionsAsync();
  let finalStatus = permissions.status;

  if (finalStatus !== 'granted') {
    const requestedPermissions = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermissions.status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    throw new Error('Missing Expo project ID for push notifications');
  }

  const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });

  return {
    token: pushToken.data,
    platform: Platform.OS,
    appIdentifier: Constants.expoConfig?.ios?.bundleIdentifier ?? null,
    deviceName: Device.modelName ?? null,
  };
}

export async function getMobilePushPermissionStatus(): Promise<MobilePushPermissionStatus> {
  const permissions = await Notifications.getPermissionsAsync();
  if (
    permissions.status === 'granted' ||
    permissions.status === 'denied' ||
    permissions.status === 'undetermined'
  ) {
    return permissions.status;
  }

  return 'undetermined';
}

export function addPushNotificationResponseListener(
  listener: (response: Notifications.NotificationResponse) => void,
) {
  return Notifications.addNotificationResponseReceivedListener(listener);
}
