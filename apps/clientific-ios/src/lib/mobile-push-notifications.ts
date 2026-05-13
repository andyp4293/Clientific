import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const PUSH_PERMISSION_REQUEST = {
  ios: {
    allowAlert: true,
    allowBadge: true,
    allowSound: true,
    provideAppNotificationSettings: true,
  },
};

export const mobileNotificationHandler = {
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
};

Notifications.setNotificationHandler(mobileNotificationHandler);

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

function hasGrantedPushPermissions(
  permissions: Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>,
) {
  return permissions.granted === true || permissions.status === 'granted';
}

export async function registerForPushNotificationsAsync(): Promise<MobilePushRegistration> {
  if (!Device.isDevice) {
    return null;
  }

  const permissions = await Notifications.getPermissionsAsync();
  let isGranted = hasGrantedPushPermissions(permissions);

  if (!isGranted) {
    const requestedPermissions = await Notifications.requestPermissionsAsync(
      PUSH_PERMISSION_REQUEST,
    );
    isGranted = hasGrantedPushPermissions(requestedPermissions);
  }

  if (!isGranted) {
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
  if (permissions.granted === true) {
    return 'granted';
  }

  if (
    permissions.status === 'granted' ||
    permissions.status === 'denied' ||
    permissions.status === 'undetermined'
  ) {
    return permissions.status;
  }

  return 'undetermined';
}

export function normalizeMobileAppBadgeCount(unreadCount: number) {
  if (!Number.isFinite(unreadCount)) {
    return 0;
  }

  return Math.max(0, Math.floor(unreadCount));
}

export async function syncMobileAppBadgeCount(unreadCount: number) {
  try {
    return await Notifications.setBadgeCountAsync(normalizeMobileAppBadgeCount(unreadCount));
  } catch (error) {
    console.warn('Unable to sync Clientific app badge count:', error);
    return false;
  }
}

export function addPushNotificationResponseListener(
  listener: (response: Notifications.NotificationResponse) => void,
) {
  return Notifications.addNotificationResponseReceivedListener(listener);
}
