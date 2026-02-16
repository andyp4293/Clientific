import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Validate configuration
const isTwilioConfigured = accountSid && authToken && twilioPhoneNumber;

if (!isTwilioConfigured) {
  console.warn('⚠️  Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env');
}

export const twilioClient = isTwilioConfigured
  ? twilio(accountSid, authToken)
  : null;

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

// Main SMS sending function
export async function sendSMS({ to, message }: SendSMSParams): Promise<SMSResult> {
  if (!twilioClient || !twilioPhoneNumber) {
    console.log('📱 SMS disabled (Twilio not configured)');
    console.log('Would have sent to:', to);
    console.log('Message:', message);
    return { success: false, error: 'Twilio not configured' };
  }

  if (!isValidPhoneNumber(to)) {
    console.error('❌ Invalid phone number:', to);
    return { success: false, error: 'Invalid phone number format' };
  }

  const formattedPhone = formatPhoneNumber(to);

  try {
    const result = await twilioClient.messages.create({
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

// Template: Appointment Confirmation
export function formatAppointmentConfirmationSMS(details: AppointmentDetails): string {
  const dateStr = formatDate(details.dateTime);
  const timeStr = formatTime(details.dateTime);
  const durationStr = details.duration ? ` (${details.duration} min)` : '';

  return `Hi ${details.customerName}! 🎉

Your appointment at ${details.businessName} is confirmed.

📋 Service: ${details.serviceName}${durationStr}
👤 With: ${details.staffName}
📅 Date: ${dateStr}
🕒 Time: ${timeStr}

See you soon!`;
}

// Template: Appointment Reminder (24 hours before)
export function formatAppointmentReminderSMS(details: ReminderDetails): string {
  const dateStr = formatDate(details.dateTime);
  const timeStr = formatTime(details.dateTime);
  const contactInfo = details.businessPhone 
    ? `\n\nNeed to reschedule? Call us at ${details.businessPhone}` 
    : '';

  return `Hi ${details.customerName}! 👋

Reminder: You have an appointment tomorrow at ${details.businessName}.

📋 Service: ${details.serviceName}
👤 With: ${details.staffName}
📅 Date: ${dateStr}
🕒 Time: ${timeStr}${contactInfo}

Looking forward to seeing you!`;
}

// Template: Appointment Cancellation
export function formatAppointmentCancellationSMS(details: CancellationDetails): string {
  const dateStr = formatDate(details.dateTime);
  const timeStr = formatTime(details.dateTime);

  return `Hi ${details.customerName},

Your appointment at ${details.businessName} has been cancelled.

📋 Service: ${details.serviceName}
📅 Was scheduled for: ${dateStr} at ${timeStr}

We hope to see you again soon!`;
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
