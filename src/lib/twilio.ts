import twilio from 'twilio';

interface SendSMSParams {
  to: string;
  message: string;
  from?: string | null;
}

interface SMSResult {
  success: boolean;
  sid?: string;
  error?: string;
}

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

interface ReminderDetails {
  customerName: string;
  serviceName: string;
  staffName: string;
  dateTime: Date;
  businessName: string;
  businessPhone?: string;
  timezone?: string;
  senderPhone?: string | null;
}

interface RescheduleDetails {
  customerName: string;
  serviceName: string;
  businessName: string;
  newDateTime: Date;
  timezone?: string;
  senderPhone?: string | null;
}

interface ReviewRequestDetails {
  businessName: string;
  customerName: string;
  googleReviewUrl?: string | null;
  yelpUrl?: string | null;
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
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  return phone.startsWith('+') ? phone : `+${cleaned}`;
}

export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
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
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || null;

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

  const client = twilio(accountSid, authToken);
  const formattedPhone = formatPhoneNumber(to);
  const preferredFrom = from && isValidPhoneNumber(from) ? formatPhoneNumber(from) : null;
  const fallbackFrom = twilioPhoneNumber && isValidPhoneNumber(twilioPhoneNumber)
    ? formatPhoneNumber(twilioPhoneNumber)
    : null;

  if (from && !preferredFrom) {
    console.warn(
      'SMS sender fallback',
      JSON.stringify({
        reason: 'invalid_preferred_from',
        preferredFrom: from,
        fallbackFrom,
      })
    );
  }

  const primarySender = preferredFrom || fallbackFrom;
  if (!primarySender) {
    console.log('SMS disabled (Twilio sender number not configured)');
    console.log('Would have sent to:', to);
    console.log('Message:', message);
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: primarySender,
      to: formattedPhone,
    });

    console.log('SMS sent successfully:', result.sid);
    return { success: true, sid: result.sid };
  } catch (error: any) {
    const shouldRetryWithFallback =
      !!preferredFrom &&
      !!fallbackFrom &&
      fallbackFrom !== preferredFrom;

    if (shouldRetryWithFallback) {
      console.warn(
        'SMS sender fallback',
        JSON.stringify({
          reason: 'preferred_send_failed',
          preferredFrom,
          fallbackFrom,
          error: error?.message || 'unknown_error',
        })
      );

      try {
        const fallbackResult = await client.messages.create({
          body: message,
          from: fallbackFrom,
          to: formattedPhone,
        });
        console.log('SMS sent successfully with fallback sender:', fallbackResult.sid);
        return { success: true, sid: fallbackResult.sid };
      } catch (fallbackError: any) {
        console.error('Failed to send SMS with fallback sender:', fallbackError);
        return {
          success: false,
          error: fallbackError?.message || 'Failed to send SMS',
        };
      }
    }

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

export function formatAppointmentReminderSMS(details: ReminderDetails): string {
  const timeStr = formatTime(details.dateTime, details.timezone);
  const message = `Reminder: Appointment tomorrow at ${details.businessName}. ${details.serviceName} with ${details.staffName} at ${timeStr}.`;
  return appendSmsComplianceFooter(message);
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
  const message = `${details.businessName}: Hi ${details.customerName}, your ${details.serviceName} appointment has been rescheduled to ${dateStr} at ${timeStr}. See you then!`;
  return appendSmsComplianceFooter(message);
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
  const link = details.googleReviewUrl || details.yelpUrl || '';
  const message = `${details.businessName}: Hi ${details.customerName}, thank you for your visit! We'd love your feedback. ${link}`;
  return appendSmsComplianceFooter(message);
}

export async function sendReviewRequest(
  phone: string,
  details: ReviewRequestDetails
): Promise<SMSResult> {
  return sendSMS({ to: phone, message: formatReviewRequestSMS(details) });
}
