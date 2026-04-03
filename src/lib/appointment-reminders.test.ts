import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const createMessage = vi.fn();
  const listMessages = vi.fn();
  const updateMessage = vi.fn();
  const listServices = vi.fn();
  const createService = vi.fn();
  const listAttachedPhoneNumbers = vi.fn();
  const attachPhoneNumber = vi.fn();
  const listIncomingPhoneNumbers = vi.fn();
  const messageContext = vi.fn((_sid: string) => ({
    update: updateMessage,
  }));
  const serviceContext = vi.fn((sid: string) => ({
    phoneNumbers: {
      list: listAttachedPhoneNumbers,
      create: attachPhoneNumber,
    },
  }));
  const twilioFactory = vi.fn(() => ({
    messages: Object.assign(messageContext, {
      create: createMessage,
      list: listMessages,
    }),
    messaging: {
      v1: {
        services: Object.assign(serviceContext, {
          list: listServices,
          create: createService,
        }),
      },
    },
    incomingPhoneNumbers: {
      list: listIncomingPhoneNumbers,
    },
  }));

  return {
    attachPhoneNumber,
    createMessage,
    createService,
    listAttachedPhoneNumbers,
    listIncomingPhoneNumbers,
    listMessages,
    listServices,
    messageContext,
    serviceContext,
    twilioFactory,
    updateMessage,
  };
});

vi.mock('twilio', () => ({
  default: hoisted.twilioFactory,
}));

import {
  cancelScheduledAppointmentReminder,
  getAppointmentReminderSendAt,
  resetAppointmentReminderSchedulingCacheForTests,
  scheduleAppointmentReminder,
} from './appointment-reminders';

const ORIGINAL_ENV = { ...process.env };

const reminderDetails = {
  customerName: 'Jordan',
  serviceName: 'Gel Manicure',
  staffName: 'Andy',
  dateTime: new Date('2026-04-10T18:00:00.000Z'),
  businessName: 'Davi Nails',
  appointmentUrl: 'https://www.clientific.app/a/ABC1234',
  timezone: 'America/New_York',
};

describe('appointment reminder scheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAppointmentReminderSchedulingCacheForTests();
    process.env.TWILIO_ACCOUNT_SID = 'AC_test';
    process.env.TWILIO_AUTH_TOKEN = 'token_test';
    process.env.TWILIO_PHONE_NUMBER = '+18557654989';
    delete process.env.TWILIO_MESSAGING_SERVICE_SID;

    hoisted.createMessage.mockResolvedValue({ sid: 'SM123' });
    hoisted.listServices.mockResolvedValue([]);
    hoisted.createService.mockResolvedValue({
      sid: 'MG_created',
      friendlyName: 'Clientific Scheduled SMS',
    });
    hoisted.listIncomingPhoneNumbers.mockResolvedValue([{ sid: 'PN_platform' }]);
    hoisted.listAttachedPhoneNumbers.mockResolvedValue([]);
    hoisted.attachPhoneNumber.mockResolvedValue({ sid: 'PN_attach' });
    hoisted.listMessages.mockResolvedValue([]);
    hoisted.updateMessage.mockResolvedValue({ sid: 'SM_old', status: 'canceled' });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('computes the reminder send time for exactly two hours before the appointment', () => {
    const sendAt = getAppointmentReminderSendAt(
      new Date('2026-04-10T18:00:00.000Z'),
      new Date('2026-04-10T12:00:00.000Z'),
    );

    expect(sendAt?.toISOString()).toBe('2026-04-10T16:00:00.000Z');
  });

  it('returns null when the appointment is too close to schedule a reminder', () => {
    const sendAt = getAppointmentReminderSendAt(
      new Date('2026-04-10T18:10:00.000Z'),
      new Date('2026-04-10T16:00:00.000Z'),
    );

    expect(sendAt).toBeNull();
  });

  it('schedules a fixed Twilio message for two hours before the appointment', async () => {
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG_configured';
    const now = new Date('2026-04-10T12:00:00.000Z');

    const result = await scheduleAppointmentReminder('+19087272437', reminderDetails, now);

    expect(result.success).toBe(true);
    expect(result.sendAt?.toISOString()).toBe('2026-04-10T16:00:00.000Z');
    expect(hoisted.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messagingServiceSid: 'MG_configured',
        scheduleType: 'fixed',
        sendAt: new Date('2026-04-10T16:00:00.000Z'),
        to: '+19087272437',
      }),
    );
  });

  it('creates and attaches the scheduled messaging service when one is not configured', async () => {
    const now = new Date('2026-04-10T12:00:00.000Z');

    const result = await scheduleAppointmentReminder('9087272437', reminderDetails, now);

    expect(result.success).toBe(true);
    expect(hoisted.createService).toHaveBeenCalledWith({
      friendlyName: 'Clientific Scheduled SMS',
    });
    expect(hoisted.attachPhoneNumber).toHaveBeenCalledWith({
      phoneNumberSid: 'PN_platform',
    });
  });

  it('cancels matching scheduled reminder messages for the same recipient', async () => {
    hoisted.listMessages.mockResolvedValue([
      {
        sid: 'SM_cancel_me',
        body:
          'Davi Nails: Reminder for your Gel Manicure with Andy appointment on Fri, Apr 10 at 2:00 PM. Details: https://www.clientific.app/a/ABC1234 Reply STOP to opt out, HELP for help.',
        status: 'scheduled',
      },
      {
        sid: 'SM_ignore',
        body: 'Something else',
        status: 'scheduled',
      },
    ]);

    const result = await cancelScheduledAppointmentReminder('+19087272437', reminderDetails);

    expect(result.success).toBe(true);
    expect(result.canceledCount).toBe(1);
    expect(hoisted.messageContext).toHaveBeenCalledWith('SM_cancel_me');
    expect(hoisted.updateMessage).toHaveBeenCalledWith({ status: 'canceled' });
  });
});
