import twilio from 'twilio';
import { PLATFORM_SMS_NUMBER } from '@/lib/sms-config';
import { isValidPhoneNumber, normalizePhoneNumber } from '@/lib/phone';
import {
  formatAppointmentReminderSMS,
  type ReminderDetails,
  type SMSResult,
} from '@/lib/twilio';

const CLIENTIFIC_SCHEDULED_MESSAGING_SERVICE = 'Clientific Scheduled SMS';
const APPOINTMENT_REMINDER_LEAD_MS = 2 * 60 * 60 * 1000;
const TWILIO_MIN_SCHEDULE_LEAD_MS = 15 * 60 * 1000;
const TWILIO_MAX_SCHEDULE_WINDOW_MS = 35 * 24 * 60 * 60 * 1000;
const CANCELLABLE_TWILIO_MESSAGE_STATUSES = new Set([
  'accepted',
  'queued',
  'scheduled',
  'sending',
]);

type TwilioClient = ReturnType<typeof twilio>;

export interface AppointmentReminderScheduleResult extends SMSResult {
  sendAt?: Date;
}

export interface AppointmentReminderCancelResult extends SMSResult {
  canceledCount?: number;
}

function getTwilioCredentials() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();

  if (!accountSid || !authToken) {
    return null;
  }

  return { accountSid, authToken };
}

function getTwilioClient(): TwilioClient | null {
  const credentials = getTwilioCredentials();
  if (!credentials) {
    return null;
  }

  return twilio(credentials.accountSid, credentials.authToken);
}

function getPlatformSenderNumber() {
  return isValidPhoneNumber(PLATFORM_SMS_NUMBER)
    ? normalizePhoneNumber(PLATFORM_SMS_NUMBER)
    : null;
}

let scheduledMessagingServiceSidPromise: Promise<string | null> | null = null;

export function resetAppointmentReminderSchedulingCacheForTests() {
  scheduledMessagingServiceSidPromise = null;
}

async function getScheduledMessagingServiceSid(client: TwilioClient): Promise<string | null> {
  if (scheduledMessagingServiceSidPromise) {
    return scheduledMessagingServiceSidPromise;
  }

  scheduledMessagingServiceSidPromise = (async () => {
    const configuredSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
    if (configuredSid) {
      return configuredSid;
    }

    const sender = getPlatformSenderNumber();
    if (!sender) {
      return null;
    }

    const existingServices = await client.messaging.v1.services.list({ limit: 20 });
    const service =
      existingServices.find((entry) => entry.friendlyName === CLIENTIFIC_SCHEDULED_MESSAGING_SERVICE) ??
      (await client.messaging.v1.services.create({
        friendlyName: CLIENTIFIC_SCHEDULED_MESSAGING_SERVICE,
      }));

    const phoneNumbers = await client.incomingPhoneNumbers.list({
      phoneNumber: sender,
      limit: 1,
    });
    const senderPhone = phoneNumbers[0];

    if (!senderPhone) {
      throw new Error(`Platform sender number ${sender} was not found in Twilio.`);
    }

    const attachedNumbers = await client.messaging.v1
      .services(service.sid)
      .phoneNumbers.list({ limit: 20 });
    const alreadyAttached = attachedNumbers.some((entry) => entry.phoneNumber === sender);

    if (!alreadyAttached) {
      await client.messaging.v1.services(service.sid).phoneNumbers.create({
        phoneNumberSid: senderPhone.sid,
      });
    }

    return service.sid;
  })();

  try {
    return await scheduledMessagingServiceSidPromise;
  } catch (error) {
    scheduledMessagingServiceSidPromise = null;
    throw error;
  }
}

export function getAppointmentReminderSendAt(startTime: Date, now = new Date()) {
  const sendAt = new Date(startTime.getTime() - APPOINTMENT_REMINDER_LEAD_MS);
  const delayMs = sendAt.getTime() - now.getTime();

  if (delayMs < TWILIO_MIN_SCHEDULE_LEAD_MS || delayMs > TWILIO_MAX_SCHEDULE_WINDOW_MS) {
    return null;
  }

  return sendAt;
}

export async function scheduleAppointmentReminder(
  phone: string,
  details: ReminderDetails,
  now = new Date(),
): Promise<AppointmentReminderScheduleResult> {
  const client = getTwilioClient();
  if (!client) {
    console.log('Appointment reminder scheduling disabled (Twilio not configured)');
    return { success: false, error: 'Twilio not configured' };
  }

  if (!isValidPhoneNumber(phone)) {
    return { success: false, error: 'Invalid phone number format' };
  }

  const sendAt = getAppointmentReminderSendAt(details.dateTime, now);
  if (!sendAt) {
    return { success: false, error: 'Appointment is outside the reminder scheduling window' };
  }

  try {
    const messagingServiceSid = await getScheduledMessagingServiceSid(client);
    if (!messagingServiceSid) {
      return { success: false, error: 'Twilio messaging service is not configured' };
    }

    const result = await client.messages.create({
      body: formatAppointmentReminderSMS(details),
      messagingServiceSid,
      scheduleType: 'fixed',
      sendAt,
      to: normalizePhoneNumber(phone),
    });

    return {
      success: true,
      sid: result.sid,
      sendAt,
    };
  } catch (error: any) {
    console.error('Failed to schedule appointment reminder SMS:', error);
    return {
      success: false,
      error: error?.message || 'Failed to schedule appointment reminder SMS',
    };
  }
}

export async function cancelScheduledAppointmentReminder(
  phone: string,
  details: ReminderDetails,
): Promise<AppointmentReminderCancelResult> {
  const client = getTwilioClient();
  if (!client) {
    return { success: false, error: 'Twilio not configured', canceledCount: 0 };
  }

  if (!isValidPhoneNumber(phone)) {
    return { success: false, error: 'Invalid phone number format', canceledCount: 0 };
  }

  const formattedPhone = normalizePhoneNumber(phone);
  const expectedBody = formatAppointmentReminderSMS(details);

  try {
    const messages = await client.messages.list({
      to: formattedPhone,
      limit: 50,
    });
    const matchingMessages = messages.filter(
      (message) =>
        message.body === expectedBody &&
        typeof message.status === 'string' &&
        CANCELLABLE_TWILIO_MESSAGE_STATUSES.has(message.status),
    );

    await Promise.all(
      matchingMessages.map((message) =>
        client.messages(message.sid).update({ status: 'canceled' }),
      ),
    );

    return {
      success: true,
      canceledCount: matchingMessages.length,
    };
  } catch (error: any) {
    console.error('Failed to cancel appointment reminder SMS:', error);
    return {
      success: false,
      error: error?.message || 'Failed to cancel appointment reminder SMS',
      canceledCount: 0,
    };
  }
}
