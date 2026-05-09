import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      create: vi.fn(),
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
const mockFindMany = prisma.mobilePushDevice.findMany as ReturnType<typeof vi.fn>;
const mockUpdateMany = prisma.mobilePushDevice.updateMany as ReturnType<typeof vi.fn>;
const mockUpsert = prisma.mobilePushDevice.upsert as ReturnType<typeof vi.fn>;
const mockDeleteMany = prisma.mobilePushDevice.deleteMany as ReturnType<typeof vi.fn>;

describe('mobile push notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotificationCreate.mockResolvedValue({ id: 'notif-1' });
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
          token: 'ExponentPushToken[token-1]',
        }),
        update: expect.objectContaining({
          businessId: 'biz-1',
          disabledAt: null,
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
      businessId: 'biz-1',
      title: 'New Booking Request',
      body: 'Jordan booked a manicure for Apr 4 at 2:00 PM',
      data: {
        link: '/dashboard/appointments',
      },
    });

    expect(result).toEqual({ delivered: 1, disabled: 1 });
    expect(fetch).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.objectContaining({
        method: 'POST',
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
