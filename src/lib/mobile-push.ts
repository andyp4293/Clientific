import { prisma } from '@/lib/prisma';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

type MobilePushDeviceModel = {
  findMany?: (args: unknown) => Promise<Array<{ token: string }>>;
  updateMany?: (args: unknown) => Promise<unknown>;
  upsert?: (args: unknown) => Promise<unknown>;
  deleteMany?: (args: unknown) => Promise<unknown>;
};

type ExpoPushTicket =
  | {
      status: 'ok';
      id?: string;
    }
  | {
      status: 'error';
      message?: string;
      details?: {
        error?: string;
      };
    };

export type RegisterMobilePushDeviceInput = {
  appIdentifier?: string | null;
  businessId: string;
  deviceName?: string | null;
  platform: string;
  token: string;
};

export type CreateBusinessNotificationInput = {
  businessId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  sendPush?: boolean;
};

function getMobilePushDeviceModel() {
  return (prisma as typeof prisma & { mobilePushDevice?: MobilePushDeviceModel }).mobilePushDevice;
}

export function isExpoPushToken(value: string) {
  return /^ExponentPushToken\[[^\]]+\]$/.test(value) || /^ExpoPushToken\[[^\]]+\]$/.test(value);
}

function shouldSendPushForNotificationType(type: string) {
  return (
    type === 'new_appointment' ||
    type === 'appointment_rescheduled' ||
    type === 'appointment_cancelled'
  );
}

function normalizePushBadgeCount(badgeCount: number | undefined) {
  if (typeof badgeCount !== 'number' || !Number.isFinite(badgeCount)) {
    return undefined;
  }

  return Math.max(0, Math.floor(badgeCount));
}

export async function registerMobilePushDevice(input: RegisterMobilePushDeviceInput) {
  const mobilePushDevice = getMobilePushDeviceModel();
  if (!mobilePushDevice?.upsert) {
    return;
  }

  if (!isExpoPushToken(input.token)) {
    throw new Error('Invalid Expo push token');
  }

  await mobilePushDevice.upsert({
    where: { token: input.token },
    update: {
      businessId: input.businessId,
      platform: input.platform,
      appIdentifier: input.appIdentifier ?? null,
      deviceName: input.deviceName ?? null,
      lastSeenAt: new Date(),
      disabledAt: null,
    },
    create: {
      businessId: input.businessId,
      token: input.token,
      platform: input.platform,
      appIdentifier: input.appIdentifier ?? null,
      deviceName: input.deviceName ?? null,
      lastSeenAt: new Date(),
    },
  });
}

export async function unregisterMobilePushDevice(input: {
  businessId: string;
  token: string;
}) {
  const mobilePushDevice = getMobilePushDeviceModel();
  if (!mobilePushDevice?.deleteMany) {
    return;
  }

  await mobilePushDevice.deleteMany({
    where: {
      businessId: input.businessId,
      token: input.token,
    },
  });
}

export async function sendBusinessPushNotification(input: {
  badgeCount?: number;
  businessId: string;
  body: string;
  data?: Record<string, unknown>;
  title: string;
}) {
  const mobilePushDevice = getMobilePushDeviceModel();
  if (!mobilePushDevice?.findMany) {
    return { delivered: 0, disabled: 0 };
  }

  const devices = await mobilePushDevice.findMany({
    where: {
      businessId: input.businessId,
      disabledAt: null,
    },
    select: {
      token: true,
    },
  });

  if (!devices.length) {
    return { delivered: 0, disabled: 0 };
  }

  const tokens = devices
    .map((device) => device.token)
    .filter((token) => isExpoPushToken(token));

  if (!tokens.length) {
    return { delivered: 0, disabled: 0 };
  }

  const badge = normalizePushBadgeCount(input.badgeCount);

  const response = await fetch(EXPO_PUSH_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(
      tokens.map((token) => ({
        to: token,
        title: input.title,
        body: input.body,
        sound: 'default',
        ...(badge === undefined ? {} : { badge }),
        data: input.data ?? {},
      })),
    ),
  });

  if (!response.ok) {
    throw new Error(`Expo push request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { data?: ExpoPushTicket[] };
  const tickets = Array.isArray(payload.data) ? payload.data : [];
  const disabledTokens = tickets.flatMap((ticket, index) => {
    if (
      ticket.status === 'error' &&
      ticket.details?.error === 'DeviceNotRegistered' &&
      typeof tokens[index] === 'string'
    ) {
      return [tokens[index]];
    }

    return [];
  });

  if (disabledTokens.length && mobilePushDevice.updateMany) {
    await mobilePushDevice.updateMany({
      where: {
        token: {
          in: disabledTokens,
        },
      },
      data: {
        disabledAt: new Date(),
      },
    });
  }

  return {
    delivered: tokens.length - disabledTokens.length,
    disabled: disabledTokens.length,
  };
}

async function getUnreadNotificationCount(businessId: string) {
  try {
    return await prisma.notification.count({
      where: {
        businessId,
        read: false,
      },
    });
  } catch (error) {
    console.warn('Unable to count unread notifications for mobile push badge:', error);
    return undefined;
  }
}

export async function createBusinessNotification(input: CreateBusinessNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      businessId: input.businessId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
    },
  });

  if (input.sendPush !== false && shouldSendPushForNotificationType(input.type)) {
    try {
      const unreadCount = await getUnreadNotificationCount(input.businessId);

      await sendBusinessPushNotification({
        badgeCount: unreadCount,
        businessId: input.businessId,
        title: input.title,
        body: input.message,
        data: {
          link: input.link ?? '/dashboard/appointments',
          type: input.type,
          notificationId: notification.id,
        },
      });
    } catch (error) {
      console.warn('Failed to send mobile push notification:', error);
    }
  }

  return notification;
}
