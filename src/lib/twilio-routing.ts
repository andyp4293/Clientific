import twilio from 'twilio';

import { normalizeOptionalPhoneNumber } from '@/lib/phone';
import { PLATFORM_SMS_NUMBER } from '@/lib/sms-config';
import { getWebhookBaseUrl } from '@/lib/app-url';

type SharedPlatformWebhookSyncStatus =
  | 'skipped'
  | 'cached'
  | 'missing_number'
  | 'unchanged'
  | 'updated';

type SharedPlatformWebhookSyncResult = {
  status: SharedPlatformWebhookSyncStatus;
  phoneNumber: string | null;
  smsWebhookUrl: string | null;
  reason?: string;
};

type SharedPlatformWebhookSyncOptions = {
  force?: boolean;
  minIntervalMs?: number;
};

type SharedPlatformWebhookCache = {
  checkedAt: number;
  phoneNumber: string;
  smsWebhookUrl: string;
};

const DEFAULT_SHARED_PLATFORM_SYNC_INTERVAL_MS = 15 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __clientificSharedPlatformSmsWebhookCache: SharedPlatformWebhookCache | undefined;
}

function getTrimmedEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized.endsWith('.local')
  );
}

export function getPublicTwilioSmsWebhookUrl(appUrl: string): string | null {
  try {
    const parsed = new URL(appUrl);
    if (parsed.protocol !== 'https:' || isLocalHostname(parsed.hostname)) {
      return null;
    }
    const webhookBase = getWebhookBaseUrl(appUrl);
    const webhookParsed = new URL(webhookBase);
    return `${webhookParsed.origin}/api/webhooks/twilio-sms`;
  } catch {
    return null;
  }
}

export function hasTwilioCredentials(): boolean {
  return !!getTrimmedEnv('TWILIO_ACCOUNT_SID') && !!getTrimmedEnv('TWILIO_AUTH_TOKEN');
}

function getTwilioClient() {
  const accountSid = getTrimmedEnv('TWILIO_ACCOUNT_SID');
  const authToken = getTrimmedEnv('TWILIO_AUTH_TOKEN');

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials are required for SMS webhook sync');
  }

  return twilio(accountSid, authToken);
}

function getSharedPlatformNumber(): string | null {
  return normalizeOptionalPhoneNumber(PLATFORM_SMS_NUMBER);
}

function getSharedPlatformWebhookCache() {
  return globalThis.__clientificSharedPlatformSmsWebhookCache;
}

function setSharedPlatformWebhookCache(phoneNumber: string, smsWebhookUrl: string) {
  globalThis.__clientificSharedPlatformSmsWebhookCache = {
    checkedAt: Date.now(),
    phoneNumber,
    smsWebhookUrl,
  };
}

export async function ensureSharedPlatformSmsWebhookConfigured(
  appUrl: string,
  options: SharedPlatformWebhookSyncOptions = {},
): Promise<SharedPlatformWebhookSyncResult> {
  const phoneNumber = getSharedPlatformNumber();
  const smsWebhookUrl = getPublicTwilioSmsWebhookUrl(appUrl);

  if (!phoneNumber) {
    return {
      status: 'skipped',
      phoneNumber: null,
      smsWebhookUrl,
      reason: 'missing_platform_number',
    };
  }

  if (!smsWebhookUrl) {
    return {
      status: 'skipped',
      phoneNumber,
      smsWebhookUrl: null,
      reason: 'invalid_public_app_url',
    };
  }

  if (!hasTwilioCredentials()) {
    return {
      status: 'skipped',
      phoneNumber,
      smsWebhookUrl,
      reason: 'missing_twilio_credentials',
    };
  }

  const minIntervalMs = options.minIntervalMs ?? DEFAULT_SHARED_PLATFORM_SYNC_INTERVAL_MS;
  const cache = getSharedPlatformWebhookCache();
  if (
    !options.force &&
    cache &&
    cache.phoneNumber === phoneNumber &&
    cache.smsWebhookUrl === smsWebhookUrl &&
    Date.now() - cache.checkedAt < minIntervalMs
  ) {
    return {
      status: 'cached',
      phoneNumber,
      smsWebhookUrl,
    };
  }

  const client = getTwilioClient();
  const matches = await client.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
  const match = matches[0] as
    | {
        sid?: string | null;
        smsUrl?: string | null;
        smsMethod?: string | null;
      }
    | undefined;

  if (!match?.sid) {
    return {
      status: 'missing_number',
      phoneNumber,
      smsWebhookUrl,
      reason: 'twilio_number_not_found',
    };
  }

  const currentSmsUrl = typeof match.smsUrl === 'string' ? match.smsUrl.trim() : null;
  const currentSmsMethod =
    typeof match.smsMethod === 'string' ? match.smsMethod.trim().toUpperCase() : null;

  if (currentSmsUrl === smsWebhookUrl && currentSmsMethod === 'POST') {
    setSharedPlatformWebhookCache(phoneNumber, smsWebhookUrl);
    return {
      status: 'unchanged',
      phoneNumber,
      smsWebhookUrl,
    };
  }

  await client.incomingPhoneNumbers(match.sid).update({
    smsUrl: smsWebhookUrl,
    smsMethod: 'POST',
  });

  setSharedPlatformWebhookCache(phoneNumber, smsWebhookUrl);
  return {
    status: 'updated',
    phoneNumber,
    smsWebhookUrl,
  };
}
