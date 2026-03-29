import twilio from 'twilio';
import { PLATFORM_SMS_NUMBER } from '@/lib/sms-config';
import { isValidPhoneNumber, normalizePhoneNumber } from '@/lib/phone';
import { formatReviewRequestSMS, type SMSResult } from '@/lib/twilio';

const CLIENTIFIC_SCHEDULED_MESSAGING_SERVICE = 'Clientific Scheduled SMS';

type TwilioClient = ReturnType<typeof twilio>;

type ReviewRequestScheduleDetails = {
  businessName: string;
  customerName: string;
  surveyUrl: string;
};

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

export function resetReviewRequestSchedulingCacheForTests() {
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

export async function scheduleReviewRequest(
  phone: string,
  details: ReviewRequestScheduleDetails,
  sendAt: Date
): Promise<SMSResult> {
  const client = getTwilioClient();
  if (!client) {
    console.log('Review scheduling disabled (Twilio not configured)');
    return { success: false, error: 'Twilio not configured' };
  }

  if (!isValidPhoneNumber(phone)) {
    return { success: false, error: 'Invalid phone number format' };
  }

  try {
    const messagingServiceSid = await getScheduledMessagingServiceSid(client);
    if (!messagingServiceSid) {
      return { success: false, error: 'Twilio messaging service is not configured' };
    }

    const result = await client.messages.create({
      body: formatReviewRequestSMS(details),
      messagingServiceSid,
      scheduleType: 'fixed',
      sendAt,
      to: normalizePhoneNumber(phone),
    });

    return {
      success: true,
      sid: result.sid,
    };
  } catch (error: any) {
    console.error('Failed to schedule review request SMS:', error);
    return {
      success: false,
      error: error?.message || 'Failed to schedule review request SMS',
    };
  }
}
