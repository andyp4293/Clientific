import twilio from 'twilio';

// Types
interface SendSMSParams {
  to: string;
  message: string;
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
}

interface CancellationDetails {
  customerName: string;
  serviceName: string;
  dateTime: Date;
  businessName: string;
}

interface ReminderDetails {
  customerName: string;
  serviceName: string;
  staffName: string;
  dateTime: Date;
  businessName: string;
  businessPhone?: string;
}

// Utility: Format phone number to E.164
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

// Utility: Validate phone number
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

// Utility: Format date for SMS
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Utility: Format time for SMS
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Main SMS sending function — reads env vars at call time (lazy) to avoid build-time null
export async function sendSMS({ to, message }: SendSMSParams): Promise<SMSResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !twilioPhoneNumber) {
    console.log('📱 SMS disabled (Twilio not configured)');
    console.log('Would have sent to:', to);
    console.log('Message:', message);
    return { success: false, error: 'Twilio not configured' };
  }

  if (!isValidPhoneNumber(to)) {
    console.error('❌ Invalid phone number:', to);
    return { success: false, error: 'Invalid phone number format' };
  }

  const client = twilio(accountSid, authToken);
  const formattedPhone = formatPhoneNumber(to);

  try {
    const result = await client.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: formattedPhone,
    });

    console.log('✅ SMS sent successfully:', result.sid);
    return { success: true, sid: result.sid };
  } catch (error: any) {
    console.error('❌ Failed to send SMS:', error);
    return {
      success: false,
      error: error?.message || 'Failed to send SMS'
    };
  }
}

// Legacy export kept for compatibility
export const twilioClient = null;

// Template: Appointment Confirmation (shortened for trial accounts)
export function formatAppointmentConfirmationSMS(details: AppointmentDetails): string {
  const dateStr = details.dateTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = formatTime(details.dateTime);

  const base = `${details.businessName}: Appt confirmed for ${dateStr} at ${timeStr}. ${details.serviceName}.`;
  return details.appointmentUrl
    ? `${base} View/cancel: ${details.appointmentUrl}`
    : `${base} See you soon!`;
}

// Template: Appointment Reminder (24 hours before) - shortened
export function formatAppointmentReminderSMS(details: ReminderDetails): string {
  const dateStr = formatDate(details.dateTime);
  const timeStr = formatTime(details.dateTime);

  return `Reminder: Appointment tomorrow at ${details.businessName}. ${details.serviceName} with ${details.staffName} at ${timeStr}.`;
}

// Template: Appointment Cancellation - shortened
export function formatAppointmentCancellationSMS(details: CancellationDetails): string {
  const dateStr = formatDate(details.dateTime);
  const timeStr = formatTime(details.dateTime);

  return `${details.businessName}: Your appointment on ${dateStr} at ${timeStr} has been cancelled. Hope to see you again soon!`;
}

// Helper: Send appointment confirmation
export async function sendAppointmentConfirmation(
  phone: string,
  details: AppointmentDetails
): Promise<SMSResult> {
  const message = formatAppointmentConfirmationSMS(details);
  return sendSMS({ to: phone, message });
}

// Helper: Send appointment reminder
export async function sendAppointmentReminder(
  phone: string,
  details: ReminderDetails
): Promise<SMSResult> {
  const message = formatAppointmentReminderSMS(details);
  return sendSMS({ to: phone, message });
}

// Helper: Send appointment cancellation
export async function sendAppointmentCancellation(
  phone: string,
  details: CancellationDetails
): Promise<SMSResult> {
  const message = formatAppointmentCancellationSMS(details);
  return sendSMS({ to: phone, message });
}
