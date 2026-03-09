import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { prisma } from '@/lib/prisma';
import { handleSmsAiInbound } from '@/lib/sms-ai';

const STOP_KEYWORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']);
const START_KEYWORDS = new Set(['START', 'UNSTOP', 'YES']);
const HELP_KEYWORDS = new Set(['HELP', 'INFO']);

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function twimlMessage(message: string): NextResponse {
  const body = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
  return new NextResponse(body, { headers: { 'Content-Type': 'text/xml' } });
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

function keywordFromBody(body: string | null | undefined): string {
  const first = (body || '').trim().split(/\s+/)[0] || '';
  return first.toUpperCase();
}

function formDataToRecord(form: FormData): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') params[key] = value;
  }
  return params;
}

function isValidTwilioSignature(req: NextRequest, params: Record<string, string>): boolean {
  if (process.env.TWILIO_VALIDATE_WEBHOOK !== 'true') return true;
  const signature = req.headers.get('x-twilio-signature');
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!signature || !authToken) return false;
  try {
    return twilio.validateRequest(authToken, signature, req.url, params);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const formParams = formDataToRecord(form);
    if (!isValidTwilioSignature(req, formParams)) {
      return NextResponse.json({ error: 'Invalid Twilio signature' }, { status: 403 });
    }

    const fromPhoneRaw = (form.get('From') as string | null) || null;
    const toPhoneRaw = (form.get('To') as string | null) || null;
    const messageBody = (form.get('Body') as string | null) || null;
    const messageSid = (form.get('MessageSid') as string | null) || null;
    const keyword = keywordFromBody(messageBody);
    const normalizedFrom = normalizePhone(fromPhoneRaw);
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    const userAgent = req.headers.get('user-agent');

    const allCustomers = await prisma.customer.findMany({
      where: { phone: { not: null } },
      select: { id: true, businessId: true, phone: true, smsOptedOut: true },
    });

    const matchingCustomers = normalizedFrom
      ? allCustomers.filter((customer) => normalizePhone(customer.phone) === normalizedFrom)
      : [];

    const customerIds = matchingCustomers.map((customer) => customer.id);
    const now = new Date();
    let eventType = 'INBOUND_MESSAGE';
    let responseText =
      'Clientific alerts: Reply STOP to opt out, START to resubscribe, HELP for help.';
    let extraMetadata: Record<string, unknown> = {};

    if (STOP_KEYWORDS.has(keyword)) {
      eventType = 'STOP';
      responseText =
        "You have been unsubscribed from Clientific SMS alerts. Reply START to resubscribe.";

      if (customerIds.length > 0) {
        await prisma.customer.updateMany({
          where: { id: { in: customerIds } },
          data: {
            smsOptedOut: true,
            smsOptedOutAt: now,
            smsConsent: false,
            smsMarketingConsent: false,
            optedInMarketing: false,
            optedOutAt: now,
          },
        });
      }
    } else if (START_KEYWORDS.has(keyword)) {
      eventType = 'START';
      responseText = 'You are resubscribed to Clientific SMS alerts. Reply STOP to opt out.';

      if (customerIds.length > 0) {
        await prisma.customer.updateMany({
          where: { id: { in: customerIds } },
          data: {
            smsOptedOut: false,
            smsOptedOutAt: null,
            smsConsent: true,
            smsMarketingConsent: true,
            smsMarketingConsentAt: now,
            optedInMarketing: true,
            optedOutAt: null,
          },
        });
      }
    } else if (HELP_KEYWORDS.has(keyword)) {
      eventType = 'HELP';
      responseText =
        'Clientific SMS Help: Reply STOP to opt out, START to resubscribe. Msg & data rates may apply.';
    } else {
      const aiResult = await handleSmsAiInbound({
        fromPhoneRaw,
        toPhoneRaw,
        messageBody,
      });
      if (aiResult?.handled) {
        eventType = aiResult.eventType;
        responseText = aiResult.text;
        extraMetadata = aiResult.metadata || {};
      }
    }

    if (matchingCustomers.length > 0) {
      await prisma.smsConsentEvent.createMany({
        data: matchingCustomers.map((customer) => ({
          businessId: customer.businessId,
          customerId: customer.id,
          phone: normalizedFrom || customer.phone || '',
          eventType,
          source: 'twilio_inbound',
          messageSid,
          messageBody,
          fromPhone: fromPhoneRaw,
          toPhone: toPhoneRaw,
          ipAddress,
          userAgent,
          metadata: {
            keyword,
            matchedCustomers: matchingCustomers.length,
            ...extraMetadata,
          },
        })),
      });
    } else {
      await prisma.smsConsentEvent.create({
        data: {
          phone: normalizedFrom || fromPhoneRaw || 'unknown',
          eventType,
          source: 'twilio_inbound',
          messageSid,
          messageBody,
          fromPhone: fromPhoneRaw,
          toPhone: toPhoneRaw,
          ipAddress,
          userAgent,
          metadata: {
            keyword,
            matchedCustomers: 0,
            ...extraMetadata,
          },
        },
      });
    }

    return twimlMessage(responseText);
  } catch (error: any) {
    console.error('POST /api/webhooks/twilio-sms error:', error);
    return twimlMessage(
      'Clientific SMS Help: Reply STOP to opt out, START to resubscribe, HELP for help.'
    );
  }
}
