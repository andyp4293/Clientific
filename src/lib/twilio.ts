import twilio from 'twilio';
import { PLATFORM_SMS_NUMBER } from '@/lib/sms-config';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';
import {
  isE164PhoneNumber,
  isValidPhoneNumber,
  normalizeOptionalPhoneNumber,
  normalizePhoneNumber,
} from '@/lib/phone';
import { ensureSharedPlatformSmsWebhookConfigured } from '@/lib/twilio-routing';

export { isE164PhoneNumber, isValidPhoneNumber, normalizeOptionalPhoneNumber } from '@/lib/phone';

interface SendSMSParams {
  to: string;
  message: string;
  from?: string | null;
}

export interface SMSResult {
  success: boolean;
  sid?: string;
  error?: string;
}

type TwilioClient = ReturnType<typeof twilio>;

interface AppointmentDetails {
  customerName: string;
  serviceName: string;
  staffName: string;
  dateTime: Date;
  businessName: string;
  duration?: number;
  appointmentUrl?: string;
  timezone?: string;
  senderPhone?: string | null;
}

interface AppointmentBatchDetails {
  customerName: string;
  businessName: string;
  appointmentCount: number;
  appointmentUrl: string;
  senderPhone?: string | null;
}

interface CancellationDetails {
  customerName: string;
  serviceName: string;
  dateTime: Date;
  businessName: string;
  timezone?: string;
  senderPhone?: string | null;
}

interface BusinessConfirmedDetails {
  customerName: string;
  serviceName: string;
  dateTime: Date;
  businessName: string;
  appointmentUrl?: string;
  timezone?: string;
  senderPhone?: string | null;
}

export interface ReminderDetails {
  customerName: string;
  serviceName: string;
  staffName: string;
  dateTime: Date;
  businessName: string;
  businessPhone?: string;
  appointmentUrl?: string;
  timezone?: string;
  senderPhone?: string | null;
}

interface RescheduleDetails {
  customerName: string;
  serviceName: string;
  staffName?: string | null;
  businessName: string;
  newDateTime: Date;
  appointmentUrl?: string;
  timezone?: string;
  senderPhone?: string | null;
}

interface ReviewRequestDetails {
  businessName: string;
  customerName: string;
  surveyUrl: string;
}

interface DealClaimCodeDetails {
  businessName: string;
  dealTitle: string;
  dealCode: string;
  customerName?: string | null;
  bookingUrl?: string | null;
  discountType?: string;
  discountValue?: number;
  serviceScope?: string;
  serviceName?: string | null; // single service name, or null for multi/all
}

interface DealPurchaseLinkDetails {
  businessName: string;
  dealTitle: string;
  dealUrl: string;
  customerName?: string | null;
  discountType?: string;
  discountValue?: number;
  serviceScope?: string;
  serviceName?: string | null; // single service name, or null for multi/all
}

interface DealPurchaseConfirmationDetails {
  businessName: string;
  dealTitle: string;
  redemptionCode: string;
  receiptUrl: string;
  customerName?: string | null;
}

interface KioskSignupDetails {
  businessName: string;
  customerName?: string | null;
  bookingUrl?: string | null;
}

interface KioskDealClaimDetails extends KioskSignupDetails {
  dealTitle: string;
  dealCode: string;
}

interface KioskDealPurchaseDetails extends KioskSignupDetails {
  dealTitle: string;
  dealUrl: string;
}

interface DirectCustomerMessageDetails {
  businessName: string;
  message: string;
}

const SMS_COMPLIANCE_FOOTER = 'Reply STOP to opt out, HELP for help.';
export function appendSmsComplianceFooter(message: string): string {
  const trimmed = message.trim();
  const alreadyHasFooter =
    /reply\s+stop\s+to\s+opt\s*out[, ]+\s*help\s+for\s+help\.?$/i.test(trimmed) ||
    /reply\s+stop\s+to\s+opt\s*out\.?$/i.test(trimmed);

  if (alreadyHasFooter) return trimmed;
  return `${trimmed} ${SMS_COMPLIANCE_FOOTER}`;
}

export function formatPhoneNumber(phone: string): string {
  return normalizePhoneNumber(phone);
}

function getTwilioCredentials() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();

  if (!accountSid || !authToken) {
    return null;
  }

  return { accountSid, authToken };
}

function getPlatformSenderNumber() {
  return isValidPhoneNumber(PLATFORM_SMS_NUMBER)
    ? formatPhoneNumber(PLATFORM_SMS_NUMBER)
    : null;
}

function getTwilioClient(): TwilioClient | null {
  const credentials = getTwilioCredentials();
  if (!credentials) {
    return null;
  }

  return twilio(credentials.accountSid, credentials.authToken);
}

function formatTime(date: Date, timezone?: string): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...(timezone ? { timeZone: timezone } : {}),
  });
}

export async function sendSMS({ to, message, from }: SendSMSParams): Promise<SMSResult> {
  // Some env providers (Vercel) preserve trailing newlines from copied values — trim defensively.
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!accountSid || !authToken) {
    console.log('SMS disabled (Twilio not configured)');
    console.log('Would have sent to:', to);
    console.log('Message:', message);
    return { success: false, error: 'Twilio not configured' };
  }

  if (!isValidPhoneNumber(to)) {
    console.error('Invalid phone number:', to);
    return { success: false, error: 'Invalid phone number format' };
  }

  // Always send from the platform number (PLATFORM_SMS_NUMBER / TWILIO_PHONE_NUMBER).
  // Per-business Vapi numbers are voice-only and cannot send SMS reliably.
  // To change the sender number, update TWILIO_PHONE_NUMBER in env vars or sms-config.ts.
  const sender = isValidPhoneNumber(PLATFORM_SMS_NUMBER)
    ? formatPhoneNumber(PLATFORM_SMS_NUMBER)
    : null;

  if (!sender) {
    console.log('SMS disabled (PLATFORM_SMS_NUMBER not configured)');
    console.log('Would have sent to:', to);
    console.log('Message:', message);
    return { success: false, error: 'Twilio not configured' };
  }

  const client = twilio(accountSid, authToken);
  const formattedPhone = formatPhoneNumber(to);

  try {
    await ensureSharedPlatformSmsWebhookConfigured(getConfiguredAppBaseUrl()).catch((error) => {
      console.error('[twilio] Failed to verify shared platform SMS webhook before send:', error);
    });

    const result = await client.messages.create({
      body: message,
      from: sender,
      to: formattedPhone,
    });

    console.log('SMS sent successfully:', result.sid);
    return { success: true, sid: result.sid };
  } catch (error: any) {

    console.error('Failed to send SMS:', error);
    return {
      success: false,
      error: error?.message || 'Failed to send SMS',
    };
  }
}

export const twilioClient = null;

export function formatAppointmentConfirmationSMS(details: AppointmentDetails): string {
  const tz = details.timezone || undefined;
  const dateStr = details.dateTime.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(tz ? { timeZone: tz } : {}),
  });
  const timeStr = details.dateTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...(tz ? { timeZone: tz } : {}),
  });
  const staffLine =
    details.staffName && details.staffName !== 'our team' ? ` with ${details.staffName}` : '';

  const base = `${details.businessName}: Hi ${details.customerName}, your ${details.serviceName}${staffLine} appointment has been requested for ${dateStr} at ${timeStr}. We'll send you another text once it's confirmed.`;
  const urlPart = details.appointmentUrl ? ` Check status: ${details.appointmentUrl}` : '';
  return appendSmsComplianceFooter(`${base}${urlPart}`);
}

export function formatAppointmentBusinessConfirmedSMS(details: BusinessConfirmedDetails): string {
  const tz = details.timezone || undefined;
  const dateStr = details.dateTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(tz ? { timeZone: tz } : {}),
  });
  const timeStr = formatTime(details.dateTime, tz);
  const base = `${details.businessName}: Your ${details.serviceName} appointment on ${dateStr} at ${timeStr} is CONFIRMED. See you then!`;
  const withUrl = details.appointmentUrl ? `${base} ${details.appointmentUrl}` : base;
  return appendSmsComplianceFooter(withUrl);
}

export function formatAppointmentBatchConfirmationSMS(details: AppointmentBatchDetails): string {
  const requestLabel = details.appointmentCount === 1 ? 'appointment request' : 'appointment requests';
  const verb = details.appointmentCount === 1 ? 'is' : 'are';
  const message = `${details.businessName}: Hi ${details.customerName}, your ${details.appointmentCount} ${requestLabel} ${verb} ready. Review each one here: ${details.appointmentUrl}`;
  return appendSmsComplianceFooter(message);
}

export function formatAppointmentReminderSMS(details: ReminderDetails): string {
  const tz = details.timezone || undefined;
  const dateStr = details.dateTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(tz ? { timeZone: tz } : {}),
  });
  const timeStr = formatTime(details.dateTime, tz);
  const staffLine =
    details.staffName && details.staffName !== 'our team' ? ` with ${details.staffName}` : '';
  const base = `${details.businessName}: Reminder for your ${details.serviceName}${staffLine} appointment on ${dateStr} at ${timeStr}.`;
  const withUrl = details.appointmentUrl ? `${base} Details: ${details.appointmentUrl}` : base;
  return appendSmsComplianceFooter(withUrl);
}

export function formatAppointmentCancellationSMS(details: CancellationDetails): string {
  const tz = details.timezone || undefined;
  const dateStr = details.dateTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(tz ? { timeZone: tz } : {}),
  });
  const timeStr = formatTime(details.dateTime, tz);
  const message = `Hi ${details.customerName}, your ${details.serviceName} appointment at ${details.businessName} on ${dateStr} at ${timeStr} has been cancelled. We truly appreciate your time and hope to welcome you back soon.`;
  return appendSmsComplianceFooter(message);
}

export async function sendAppointmentConfirmation(
  phone: string,
  details: AppointmentDetails
): Promise<SMSResult> {
  return sendSMS({
    to: phone,
    message: formatAppointmentConfirmationSMS(details),
    from: details.senderPhone ?? null,
  });
}

export async function sendAppointmentBatchConfirmation(
  phone: string,
  details: AppointmentBatchDetails
): Promise<SMSResult> {
  return sendSMS({
    to: phone,
    message: formatAppointmentBatchConfirmationSMS(details),
    from: details.senderPhone ?? null,
  });
}

export async function sendAppointmentReminder(
  phone: string,
  details: ReminderDetails
): Promise<SMSResult> {
  return sendSMS({
    to: phone,
    message: formatAppointmentReminderSMS(details),
    from: details.senderPhone ?? null,
  });
}

export async function sendAppointmentCancellation(
  phone: string,
  details: CancellationDetails
): Promise<SMSResult> {
  return sendSMS({
    to: phone,
    message: formatAppointmentCancellationSMS(details),
    from: details.senderPhone ?? null,
  });
}

export async function sendAppointmentBusinessConfirmed(
  phone: string,
  details: BusinessConfirmedDetails
): Promise<SMSResult> {
  return sendSMS({
    to: phone,
    message: formatAppointmentBusinessConfirmedSMS(details),
    from: details.senderPhone ?? null,
  });
}

export function formatAppointmentRescheduledSMS(details: RescheduleDetails): string {
  const tz = details.timezone || undefined;
  const dateStr = details.newDateTime.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(tz ? { timeZone: tz } : {}),
  });
  const timeStr = details.newDateTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...(tz ? { timeZone: tz } : {}),
  });
  const staffLine =
    details.staffName && details.staffName !== 'our team' ? ` with ${details.staffName}` : '';
  const base = `${details.businessName}: Hi ${details.customerName}, your ${details.serviceName}${staffLine} appointment has been updated to ${dateStr} at ${timeStr}. See you then!`;
  const withUrl = details.appointmentUrl ? `${base} Details: ${details.appointmentUrl}` : base;
  return appendSmsComplianceFooter(withUrl);
}

export async function sendAppointmentRescheduled(
  phone: string,
  details: RescheduleDetails
): Promise<SMSResult> {
  return sendSMS({
    to: phone,
    message: formatAppointmentRescheduledSMS(details),
    from: details.senderPhone ?? null,
  });
}

export function formatReviewRequestSMS(details: ReviewRequestDetails): string {
  const message = `${details.businessName}: Hi ${details.customerName}, thanks for visiting today. We would love a quick rating and any feedback you want to share: ${details.surveyUrl}`;
  return appendSmsComplianceFooter(message);
}

function formatDealDescription(
  discountType?: string,
  discountValue?: number,
  serviceScope?: string,
  serviceName?: string | null
): string | null {
  if (!discountType) return null;

  let discount: string;
  if (discountType === 'free_service') {
    discount = serviceName ? `free ${serviceName}` : 'a free service';
    return discount;
  }
  if (discountType === 'percent_off' && discountValue != null) {
    discount = `${discountValue}% off`;
  } else if (discountType === 'amount_off' && discountValue != null) {
    discount = `$${discountValue % 1 === 0 ? discountValue : discountValue.toFixed(2)} off`;
  } else {
    return null;
  }

  const scope =
    serviceScope === 'selected_services'
      ? serviceName
        ? ` ${serviceName}`
        : ' select services'
      : ' any service';

  return `${discount}${scope}`;
}

export function formatDealClaimCodeSMS(details: DealClaimCodeDetails): string {
  const firstName = details.customerName?.trim().split(/\s+/).filter(Boolean)[0] ?? null;
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const desc = formatDealDescription(details.discountType, details.discountValue, details.serviceScope, details.serviceName);
  const dealInfo = desc ? `${details.dealTitle} — ${desc}` : details.dealTitle;
  const base = `${greeting} ${details.businessName} sent you a deal: ${dealInfo}. Your code is ${details.dealCode}. Show it at checkout.`;
  const withBooking = details.bookingUrl ? `${base} Book here: ${details.bookingUrl}` : base;
  return appendSmsComplianceFooter(withBooking);
}

export function formatDealPurchaseLinkSMS(details: DealPurchaseLinkDetails): string {
  const firstName = details.customerName?.trim().split(/\s+/).filter(Boolean)[0] ?? null;
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const desc = formatDealDescription(details.discountType, details.discountValue, details.serviceScope, details.serviceName);
  const dealInfo = desc ? `${details.dealTitle} — ${desc}` : details.dealTitle;
  return appendSmsComplianceFooter(
    `${greeting} ${details.businessName} sent you a deal: ${dealInfo}. Claim it here: ${details.dealUrl}`
  );
}

export function formatDealPurchaseConfirmationSMS(details: DealPurchaseConfirmationDetails): string {
  const firstName = details.customerName?.trim().split(/\s+/).filter(Boolean)[0] ?? null;
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  return appendSmsComplianceFooter(
    `${greeting} thanks for purchasing ${details.dealTitle} from ${details.businessName}. Your redemption code is ${details.redemptionCode}. View your receipt: ${details.receiptUrl}`
  );
}

export function formatKioskSignupConfirmationSMS(details: KioskSignupDetails): string {
  const firstName = details.customerName?.trim().split(/\s+/).filter(Boolean)[0] ?? null;
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const base = `${greeting} thanks for signing up with ${details.businessName}. You're now on the ${details.businessName} text list for offers and updates.`;
  const withBooking = details.bookingUrl ? `${base} Book anytime: ${details.bookingUrl}` : base;
  return appendSmsComplianceFooter(withBooking);
}

export function formatKioskDealClaimSMS(details: KioskDealClaimDetails): string {
  const firstName = details.customerName?.trim().split(/\s+/).filter(Boolean)[0] ?? null;
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const base = `${greeting} thanks for signing up with ${details.businessName}. You're now on the ${details.businessName} text list for future offers and updates. Your ${details.dealTitle} code is ${details.dealCode}. Show it at checkout.`;
  const withBooking = details.bookingUrl ? `${base} Book here: ${details.bookingUrl}` : base;
  return appendSmsComplianceFooter(withBooking);
}

export function formatKioskDealPurchaseSMS(details: KioskDealPurchaseDetails): string {
  const firstName = details.customerName?.trim().split(/\s+/).filter(Boolean)[0] ?? null;
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const base = `${greeting} thanks for signing up with ${details.businessName}. You're on the ${details.businessName} text list, and your ${details.dealTitle} purchase link is ready: ${details.dealUrl}`;
  const withBooking = details.bookingUrl ? `${base} Book here anytime: ${details.bookingUrl}` : base;
  return appendSmsComplianceFooter(withBooking);
}

export function formatDirectCustomerMessageSMS(details: DirectCustomerMessageDetails): string {
  return appendSmsComplianceFooter(`${details.businessName}: ${details.message.trim()}`);
}

export async function sendReviewRequest(
  phone: string,
  details: ReviewRequestDetails
): Promise<SMSResult> {
  return sendSMS({ to: phone, message: formatReviewRequestSMS(details) });
}
