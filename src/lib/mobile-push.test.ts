import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      create: vi.fn(),
      count: vi.fn(),
    },
    mobilePushDevice: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import {
  createBusinessNotification,
  isExpoPushToken,
  registerMobilePushDevice,
  sendBusinessPushNotification,
  unregisterMobilePushDevice,
} from '@/lib/mobile-push';

const mockNotificationCreate = prisma.notification.create as ReturnType<typeof vi.fn>;
const mockNotificationCount = prisma.notification.count as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.mobilePushDevice.findMany as ReturnType<typeof vi.fn>;
const mockUpdateMany = prisma.mobilePushDevice.updateMany as ReturnType<typeof vi.fn>;
const mockUpsert = prisma.mobilePushDevice.upsert as ReturnType<typeof vi.fn>;
const mockDeleteMany = prisma.mobilePushDevice.deleteMany as ReturnType<typeof vi.fn>;

describe('mobile push notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotificationCreate.mockResolvedValue({ id: 'notif-1' });
    mockNotificationCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([]);
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockUpsert.mockResolvedValue({});
    mockDeleteMany.mockResolvedValue({ count: 1 });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok', id: 'ticket-1' }],
        }),
      })),
    );
  });

  it('validates Expo push token formats', () => {
    expect(isExpoPushToken('ExponentPushToken[token-1]')).toBe(true);
    expect(isExpoPushToken('ExpoPushToken[token-2]')).toBe(true);
    expect(isExpoPushToken('bad-token')).toBe(false);
  });

  it('registers a mobile push device for a business', async () => {
    await registerMobilePushDevice({
      businessId: 'biz-1',
      token: 'ExponentPushToken[token-1]',
      platform: 'ios',
      appIdentifier: 'app.clientific.mobile',
      deviceName: 'iPhone 17 Pro',
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: 'ExponentPushToken[token-1]' },
        create: expect.objectContaining({
          businessId: 'biz-1',
          staffId: null,
          token: 'ExponentPushToken[token-1]',
        }),
        update: expect.objectContaining({
          businessId: 'biz-1',
          staffId: null,
          disabledAt: null,
        }),
      }),
    );
  });

  it('registers a mobile push device for a specific employee', async () => {
    await registerMobilePushDevice({
      businessId: 'biz-1',
      staffId: 'staff-1',
      token: 'ExponentPushToken[staff-phone]',
      platform: 'ios',
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: 'ExponentPushToken[staff-phone]' },
        create: expect.objectContaining({
          businessId: 'biz-1',
          staffId: 'staff-1',
        }),
        update: expect.objectContaining({
          businessId: 'biz-1',
          staffId: 'staff-1',
        }),
      }),
    );
  });

  it('unregisters a mobile push device', async () => {
    await unregisterMobilePushDevice({
      businessId: 'biz-1',
      token: 'ExponentPushToken[token-1]',
    });

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: {
        businessId: 'biz-1',
        staffId: null,
        token: 'ExponentPushToken[token-1]',
      },
    });
  });

  it('sends push notifications to active devices and disables invalid tokens', async () => {
    mockFindMany.mockResolvedValue([
      { token: 'ExponentPushToken[live-token]' },
      { token: 'ExponentPushToken[dead-token]' },
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            { status: 'ok', id: 'ticket-live' },
            {
              status: 'error',
              details: {
                error: 'DeviceNotRegistered',
              },
            },
          ],
        }),
      })),
    );

    const result = await sendBusinessPushNotification({
      badgeCount: 4,
      businessId: 'biz-1',
      title: 'New Booking Request',
      body: 'Jordan booked a manicure for Apr 4 at 2:00 PM',
      data: {
        link: '/dashboard/appointments',
      },
    });

    expect(result).toEqual({ delivered: 1, disabled: 1 });
    const pushPayload = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(pushPayload).toEqual([
      expect.objectContaining({
        to: 'ExponentPushToken[live-token]',
        badge: 4,
        sound: 'default',
      }),
      expect.objectContaining({
        to: 'ExponentPushToken[dead-token]',
        badge: 4,
        sound: 'default',
      }),
    ]);
    expect(fetch).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'biz-1',
          staffId: null,
        }),
      }),
    );
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        token: {
          in: ['ExponentPushToken[dead-token]'],
        },
      },
      data: {
        disabledAt: expect.any(Date),
      },
    });
  });

  it('stores the notification and sends push for appointment request types', async () => {
    mockFindMany.mockResolvedValue([{ token: 'ExponentPushToken[live-token]' }]);
    mockNotificationCount.mockResolvedValue(7);

    await createBusinessNotification({
      businessId: 'biz-1',
      type: 'new_appointment',
      title: 'New Booking Request',
      message: 'Jordan booked a manicure for Apr 4 at 2:00 PM',
      link: '/dashboard/appointments',
    });

    expect(mockNotificationCreate).toHaveBeenCalledWith({
      data: {
        businessId: 'biz-1',
        type: 'new_appointment',
        title: 'New Booking Request',
        message: 'Jordan booked a manicure for Apr 4 at 2:00 PM',
        link: '/dashboard/appointments',
      },
    });
    expect(fetch).toHaveBeenCalled();
    const pushPayload = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(pushPayload[0]).toMatchObject({
      badge: 7,
      data: {
        link: '/dashboard/appointments',
        type: 'new_appointment',
        notificationId: 'notif-1',
      },
    });
  });

  it('sends assigned appointment pushes to owner devices and that employee only', async () => {
    mockFindMany
      .mockResolvedValueOnce([{ token: 'ExponentPushToken[owner-phone]' }])
      .mockResolvedValueOnce([{ token: 'ExponentPushToken[staff-phone]' }]);
    mockNotificationCount.mockResolvedValue(3);

    await createBusinessNotification({
      businessId: 'biz-1',
      staffId: 'staff-1',
      type: 'new_appointment',
      title: 'New Booking Request',
      message: 'Mina booked Gel Manicure with Taylor for Thu, May 14, 2:00 PM.',
      link: '/dashboard/appointments',
    });

    expect(mockFindMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'biz-1',
          staffId: null,
        }),
      }),
    );
    expect(mockFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'biz-1',
          staffId: 'staff-1',
        }),
      }),
    );

    const ownerPayload = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    const staffPayload = JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body));
    expect(ownerPayload[0]).toMatchObject({
      to: 'ExponentPushToken[owner-phone]',
      badge: 3,
      body: 'Mina booked Gel Manicure with Taylor for Thu, May 14, 2:00 PM.',
    });
    expect(staffPayload[0]).toMatchObject({
      to: 'ExponentPushToken[staff-phone]',
      badge: 1,
      body: 'Mina booked Gel Manicure with Taylor for Thu, May 14, 2:00 PM.',
      data: expect.objectContaining({
        staffId: 'staff-1',
        link: '/dashboard/appointments',
      }),
    });
  });

  it('also sends push notifications for appointment cancellations', async () => {
    mockFindMany.mockResolvedValue([{ token: 'ExponentPushToken[live-token]' }]);

    await createBusinessNotification({
      businessId: 'biz-1',
      type: 'appointment_cancelled',
      title: 'Appointment cancelled',
      message: 'Jordan cancelled their haircut for Apr 4 at 2:00 PM',
      link: '/dashboard/appointments',
    });

    expect(fetch).toHaveBeenCalled();
  });
});
