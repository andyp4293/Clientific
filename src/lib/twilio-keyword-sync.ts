import twilio from 'twilio';
import { prisma } from '@/lib/prisma';
import { PLATFORM_SMS_NUMBER } from '@/lib/sms-config';
import {
  buildCustomerPhoneMatchClauses,
  isValidPhoneNumber,
  normalizePhoneNumber,
  normalizeOptionalStoredPhoneNumber,
} from '@/lib/phone';

const STOP_KEYWORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']);
const START_KEYWORDS = new Set(['START', 'UNSTOP', 'YES']);
const KEYWORD_SYNC_LIMIT = 25;
const KEYWORD_SYNC_INTERVAL_MS = 15_000;

let lastKeywordSyncAt = 0;
let keywordSyncInFlight: Promise<void> | null = null;

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();

  if (!accountSid || !authToken) {
    return null;
  }

  return twilio(accountSid, authToken);
}

function getSharedSenderNumber() {
  return isValidPhoneNumber(PLATFORM_SMS_NUMBER) ? normalizePhoneNumber(PLATFORM_SMS_NUMBER) : null;
}

function keywordFromBody(body: string | null | undefined): string {
  const firstToken = (body || '').trim().split(/\s+/)[0] || '';
  return firstToken.toUpperCase();
}

function getEventTypeFromBody(body: string | null | undefined): 'START' | 'STOP' | null {
  const keyword = keywordFromBody(body);
  if (STOP_KEYWORDS.has(keyword)) return 'STOP';
  if (START_KEYWORDS.has(keyword)) return 'START';
  return null;
}

function getConsentUpdateData(eventType: 'START' | 'STOP', occurredAt: Date) {
  if (eventType === 'STOP') {
    return {
      smsOptedOut: true,
      smsOptedOutAt: occurredAt,
      smsConsent: false,
      smsMarketingConsent: false,
      optedInMarketing: false,
      optedOutAt: occurredAt,
    };
  }

  return {
    smsOptedOut: false,
    smsOptedOutAt: null,
    smsConsent: true,
    smsMarketingConsent: true,
    smsMarketingConsentAt: occurredAt,
    optedInMarketing: true,
    optedOutAt: null,
  };
}

export async function syncRecentTwilioKeywordMessages(options?: { force?: boolean }) {
  const now = Date.now();
  if (!options?.force && now - lastKeywordSyncAt < KEYWORD_SYNC_INTERVAL_MS) {
    return;
  }

  if (keywordSyncInFlight) {
    return keywordSyncInFlight;
  }

  keywordSyncInFlight = (async () => {
    try {
      const client = getTwilioClient();
      const sharedSender = getSharedSenderNumber();

      if (!client || !sharedSender) {
        return;
      }

      const recentMessages = await client.messages.list({
        to: sharedSender,
        limit: KEYWORD_SYNC_LIMIT,
      });

      const keywordMessages = recentMessages
        .map((message) => ({
          sid: message.sid || null,
          from: message.from || null,
          to: message.to || null,
          body: message.body || null,
          dateCreated: message.dateCreated ? new Date(message.dateCreated) : null,
          eventType: getEventTypeFromBody(message.body || null),
        }))
        .filter(
          (
            message
          ): message is {
            sid: string;
            from: string | null;
            to: string | null;
            body: string | null;
            dateCreated: Date | null;
            eventType: 'START' | 'STOP';
          } => Boolean(message.sid && message.eventType)
        )
        .sort((left, right) => {
          const leftTime = left.dateCreated?.getTime() ?? 0;
          const rightTime = right.dateCreated?.getTime() ?? 0;
          return leftTime - rightTime;
        });

      if (keywordMessages.length === 0) {
        return;
      }

      const existingEvents = await prisma.smsConsentEvent.findMany({
        where: {
          messageSid: {
            in: keywordMessages.map((message) => message.sid),
          },
        },
        select: {
          messageSid: true,
        },
      });

      const existingMessageSids = new Set(
        existingEvents.map((event) => event.messageSid).filter((value): value is string => Boolean(value))
      );

      for (const message of keywordMessages) {
        if (existingMessageSids.has(message.sid)) {
          continue;
        }

        const phoneClauses = buildCustomerPhoneMatchClauses(message.from || '');
        const occurredAt = message.dateCreated || new Date();
        const normalizedStoredPhone =
          normalizeOptionalStoredPhoneNumber(message.from) || normalizeOptionalStoredPhoneNumber(message.to);

        const matchingCustomers =
          phoneClauses.length > 0
            ? await prisma.customer.findMany({
                where: {
                  OR: phoneClauses,
                },
                select: {
                  id: true,
                  businessId: true,
                  phone: true,
                },
              })
            : [];

        if (matchingCustomers.length > 0) {
          await prisma.customer.updateMany({
            where: {
              id: {
                in: matchingCustomers.map((customer) => customer.id),
              },
            },
            data: getConsentUpdateData(message.eventType, occurredAt),
          });

          await prisma.smsConsentEvent.createMany({
            data: matchingCustomers.map((customer) => ({
              businessId: customer.businessId,
              customerId: customer.id,
              phone: normalizedStoredPhone || customer.phone || '',
              eventType: message.eventType,
              source: 'twilio_inbound',
              messageSid: message.sid,
              messageBody: message.body,
              fromPhone: message.from,
              toPhone: message.to,
              metadata: {
                keyword: keywordFromBody(message.body),
                matchedCustomers: matchingCustomers.length,
                reconciledFromTwilioHistory: true,
              },
            })),
          });
        } else {
          await prisma.smsConsentEvent.create({
            data: {
              phone: normalizedStoredPhone || message.from || message.to || 'unknown',
              eventType: message.eventType,
              source: 'twilio_inbound',
              messageSid: message.sid,
              messageBody: message.body,
              fromPhone: message.from,
              toPhone: message.to,
              metadata: {
                keyword: keywordFromBody(message.body),
                matchedCustomers: 0,
                reconciledFromTwilioHistory: true,
              },
            },
          });
        }
      }
    } catch (error) {
      console.error('[twilio-keyword-sync] Failed to reconcile Twilio keyword messages:', error);
    } finally {
      lastKeywordSyncAt = Date.now();
      keywordSyncInFlight = null;
    }
  })();

  return keywordSyncInFlight;
}
