import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  buildCustomerPhoneData,
  buildCustomerPhoneMatchClauses,
  normalizeOptionalStoredPhoneNumber,
} from '@/lib/phone';
import {
  normalizeOptionalPhoneNumber,
  sendAppointmentBatchConfirmation,
  sendAppointmentConfirmation,
} from '@/lib/twilio';
import { validateBusinessHoursForAppointment } from '@/lib/business-hours-validation';
import { describeBusinessClosure, findBusinessClosureForDate } from '@/lib/business-closures';
import {
  localToUTC,
  weekdayIndexForLocalDate,
  weekdayIndexInTimeZone,
} from '@/lib/timezone';
import { getConfiguredAppBaseUrl, getConfiguredWebhookBaseUrl } from '@/lib/app-url';
import { validateBookableStaffSelection } from '@/lib/staff-service-validation';
import {
  buildAppointmentStartOptions,
  formatStaffAvailabilitySummary,
  getEffectiveStaffDayHours,
  normalizeBusinessHoursRecord,
} from '@/lib/staff-schedule';
import { createAppointmentBatchToken } from '@/lib/appointment-confirmation-batches';
import {
  buildAiAppointmentBatchWhereInput,
  getBufferedAppointmentBatchWindow,
} from '@/lib/ai-appointment-batches';
import { createBusinessNotification } from '@/lib/mobile-push';
import { cancelScheduledAppointmentReminder } from '@/lib/appointment-reminders';
import { resolveAppointmentServiceDisplayName } from '@/lib/appointment-services';
import {
  getAiReceptionistSelectionReminder,
  getAiReceptionistSelectionPrompt,
  getAiReceptionistVoiceGreeting,
  getAiReceptionistVoicemailMessage,
} from '@/lib/ai-receptionist-language';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Serialization error detection ───────────────────────────────────────────

function isSerializationError(err: any): boolean {
  const msg: string = err?.message ?? '';
  return (
    msg.includes('could not serialize access') ||
    msg.includes('deadlock detected') ||
    err?.code === 'P2034'
  );
}

// ─── Secret verification ──────────────────────────────────────────────────────
// Vapi sends serverUrlSecret as the header x-vapi-secret (plain passthrough,
// not HMAC). See: https://docs.vapi.ai/server-url/secret

function verifyVapiSecret(secret: string | null): boolean {
  const expected = process.env.VAPI_WEBHOOK_SECRET;
  if (!expected) return true; // not configured → skip verification
  if (!secret) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ─── Business hours formatting ────────────────────────────────────────────────

function formatBusinessHours(hours: any): string {
  if (!hours) return 'Hours not specified.';
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  try {
    const parsed = typeof hours === 'string' ? JSON.parse(hours) : hours;
    return days.map((day, i) => {
      const h = parsed[i.toString()] ?? (Array.isArray(parsed) ? parsed[i] : null);
      if (!h || !h.isOpen) return `${day}: Closed`;
      return `${day}: ${h.openTime} – ${h.closeTime}`;
    }).join('\n');
  } catch {
    return 'Hours not available — direct caller to contact the business.';
  }
}

function formatSpecialClosures(
  closures: BusinessData['closureDates'] | null | undefined,
  timezone: string
): string {
  if (!closures?.length) return 'No specific closure dates are scheduled.';

  return closures
    .map((closure) => {
      const date = new Date(`${closure.date}T12:00:00.000Z`);
      const formattedDate = date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: timezone,
      });

      return closure.label
        ? `${formattedDate}: closed for ${closure.label}`
        : `${formattedDate}: closed`;
    })
    .join('\n');
}

function formatSpokenDate(date: Date, timezone: string): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  });
}

function formatSpokenTime(date: Date, timezone: string): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
}

function formatSpokenDateTime(date: Date, timezone: string): string {
  return `${formatSpokenDate(date, timezone)} at ${formatSpokenTime(date, timezone)}`;
}

// ─── Time string parser ───────────────────────────────────────────────────────
// Parses human-readable times like "3 PM", "3:30 PM", "15:00", "10am"

function parseTimeString(timeStr: string): { hour: number; minute: number } | null {
  const normalized = timeStr.trim().toUpperCase().replace(/\./g, '');
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2] ?? '0', 10);
  const meridiem = match[3];
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

// ─── Timezone-aware slot conversion ──────────────────────────────────────────

const businessTimeToUTC = localToUTC;

// ─── Types ────────────────────────────────────────────────────────────────────

type BusinessData = {
  id: string;
  name: string;
  businessType: string;
  phone: string;
  notifyNewBookingEmail: boolean;
  vapiPhoneNumber: string | null;
  publicId: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  timezone: string;
  aiReceptionistGreeting: string | null;
  aiReceptionistSpanishEnabled: boolean;
  aiReceptionistPhone: string | null;
  aiReceptionistFaq: unknown;
  services: { id: string; name: string; price: number | null; duration: number }[];
  staff: { id: string; fullName: string; role: string; workDays: number[]; workHours: unknown }[];
  businessHours: { hours: any } | null;
  closureDates: { date: string; label: string | null }[];
};

type CallConversationMessage = {
  role?: string;
  content?: string;
  tool_calls?: Array<{
    function?: {
      name?: string;
      arguments?: string | Record<string, unknown>;
    };
  }>;
};

type StaffPreferenceSignal =
  | { kind: 'set'; staffId: string; staffName: string }
  | { kind: 'clear' }
  | { kind: 'unknown'; staffName: string };

type ResolvedServiceSelection = {
  primaryServiceId: string;
  serviceIds: string[];
  services: { id: string; name: string; duration: number }[];
  totalDuration: number;
  spokenLabel: string;
};

type MatchedCustomerRecord = {
  id: string;
  name: string;
  phone: string | null;
  phoneLookupKey: string | null;
};

type AiManagedAppointment = {
  id: string;
  businessId: string;
  customerId: string;
  serviceId: string | null;
  serviceIds: string[];
  staffId: string | null;
  startTime: Date;
  endTime: Date;
  duration: number;
  status: string;
  notes: string | null;
  source: string;
  shortId: string | null;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    smsConsent: boolean;
    smsOptedOut: boolean;
  };
  service: {
    name: string;
  } | null;
  staff: {
    fullName: string;
  } | null;
};

type AppointmentRescheduleTarget = {
  appointment: AiManagedAppointment;
  start: Date;
  end: Date;
};

const MAX_VAPI_APPOINTMENT_SERVICES = 5;
const STAFF_CLEAR_PATTERNS = [
  /\banyone\b/i,
  /\bno preference\b/i,
  /\bwhoever\b/i,
  /\bdoes(?:n't| not) matter\b/i,
  /\beither one\b/i,
  /\bany tech\b/i,
  /\bany stylist\b/i,
];

const AI_ENABLED_BUSINESS_SELECT = {
  id: true,
  name: true,
  businessType: true,
  phone: true,
  notifyNewBookingEmail: true,
  vapiPhoneNumber: true,
  publicId: true,
  street: true,
  city: true,
  state: true,
  timezone: true,
  aiReceptionistGreeting: true,
  aiReceptionistSpanishEnabled: true,
  aiReceptionistPhone: true,
  aiReceptionistFaq: true,
  services: {
    where: { active: true },
    select: { id: true, name: true, price: true, duration: true },
    take: 20,
  },
  staff: {
    where: { active: true },
    select: { id: true, fullName: true, role: true, workDays: true, workHours: true },
    take: 20,
  },
  businessHours: { select: { hours: true } },
  closureDates: {
    select: {
      date: true,
      label: true,
    },
    orderBy: { date: 'asc' },
    take: 60,
  },
} satisfies Prisma.BusinessSelect;

function getTooManyServicesMessage(): string {
  return `I can help book up to ${MAX_VAPI_APPOINTMENT_SERVICES} services in one appointment. Which ${MAX_VAPI_APPOINTMENT_SERVICES} services would you like to keep together?`;
}

function parseToolArguments(rawArgs: unknown): Record<string, unknown> {
  if (!rawArgs) return {};
  if (typeof rawArgs === 'string') {
    try {
      const parsed = JSON.parse(rawArgs);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  return typeof rawArgs === 'object' ? rawArgs as Record<string, unknown> : {};
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeNameCandidate(rawValue: string): string {
  return rawValue
    .replace(/\s+/g, ' ')
    .replace(/[^a-zA-Z' -]/g, '')
    .trim();
}

function extractRequestedStaffName(text: string): string | null {
  const match = text.match(/\bwith\s+([a-z][a-z' -]{0,40})/i);
  if (!match) return null;

  const candidate = normalizeNameCandidate(
    match[1].split(/\b(?:on|for|at|this|next|today|tomorrow|morning|afternoon|evening|night|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i)[0] ?? ''
  );

  return candidate || null;
}

function matchStaffByRequestedName(
  requestedName: string,
  staffList: BusinessData['staff']
): { match: BusinessData['staff'][number] | null; ambiguous: boolean } {
  const normalizedRequested = requestedName.toLowerCase();
  const exact = staffList.find(
    (staffMember) => staffMember.fullName.trim().toLowerCase() === normalizedRequested
  );
  if (exact) return { match: exact, ambiguous: false };

  const tokenMatches = staffList.filter((staffMember) => {
    const tokens = staffMember.fullName
      .toLowerCase()
      .split(/[^a-z0-9']+/)
      .filter(Boolean);
    return tokens.includes(normalizedRequested);
  });

  if (tokenMatches.length === 1) return { match: tokenMatches[0], ambiguous: false };
  return { match: null, ambiguous: tokenMatches.length > 1 };
}

function inferStaffPreferenceFromText(
  text: string,
  staffList: BusinessData['staff']
): StaffPreferenceSignal | undefined {
  if (STAFF_CLEAR_PATTERNS.some((pattern) => pattern.test(text))) {
    return { kind: 'clear' };
  }

  for (const staffMember of staffList) {
    const fullNamePattern = new RegExp(`\\b${escapeRegExp(staffMember.fullName)}\\b`, 'i');
    if (fullNamePattern.test(text)) {
      return { kind: 'set', staffId: staffMember.id, staffName: staffMember.fullName };
    }
  }

  const requestedName = extractRequestedStaffName(text);
  if (!requestedName) return undefined;

  const { match, ambiguous } = matchStaffByRequestedName(requestedName, staffList);
  if (match) {
    return { kind: 'set', staffId: match.id, staffName: match.fullName };
  }
  if (!ambiguous) {
    return { kind: 'unknown', staffName: requestedName };
  }

  return undefined;
}

function inferStaffPreferenceFromConversation(
  conversation: CallConversationMessage[],
  staffList: BusinessData['staff']
): StaffPreferenceSignal | undefined {
  let signal: StaffPreferenceSignal | undefined;

  for (const message of conversation) {
    if (message.role === 'assistant' && Array.isArray(message.tool_calls)) {
      for (const toolCall of message.tool_calls) {
        const parsedArgs = parseToolArguments(toolCall?.function?.arguments);
        const toolStaffId = typeof parsedArgs.staffId === 'string' ? parsedArgs.staffId : null;
        if (!toolStaffId) continue;
        const matchedStaff = staffList.find((staffMember) => staffMember.id === toolStaffId);
        if (matchedStaff) {
          signal = { kind: 'set', staffId: matchedStaff.id, staffName: matchedStaff.fullName };
        }
      }
    }

    if (message.role === 'user' && typeof message.content === 'string') {
      const nextSignal = inferStaffPreferenceFromText(message.content, staffList);
      if (nextSignal) signal = nextSignal;
    }
  }

  return signal;
}

function getRequestedServiceIds(args: any): string[] {
  const rawIds = [
    ...(Array.isArray(args?.serviceIds) ? args.serviceIds : []),
    ...(typeof args?.serviceId === 'string' ? [args.serviceId] : []),
  ];

  return Array.from(
    new Set(
      rawIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    )
  );
}

function getRequestedAppointmentIds(args: any): string[] {
  const rawIds = [
    ...(Array.isArray(args?.appointmentIds) ? args.appointmentIds : []),
    ...(typeof args?.appointmentId === 'string' ? [args.appointmentId] : []),
  ];

  return Array.from(
    new Set(
      rawIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    )
  );
}

function formatServiceList(names: string[]): string {
  if (names.length === 0) return 'appointment';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function getPreferredCustomerName(
  providedName: unknown,
  matchedCustomer: MatchedCustomerRecord | null
): string | null {
  const normalizedProvided =
    typeof providedName === 'string' ? normalizeNameCandidate(providedName) : '';

  if (normalizedProvided) return normalizedProvided;
  if (matchedCustomer?.name) return matchedCustomer.name.trim();
  return null;
}

function getKnownCallerConfirmationPrompt(matchedCustomer: MatchedCustomerRecord | null): string {
  if (!matchedCustomer?.name) {
    return 'What name should I put this under?';
  }

  const firstName = matchedCustomer.name.trim().split(/\s+/)[0] || matchedCustomer.name.trim();
  return `I have your name as ${firstName}. Is that right?`;
}

function getRequestedDateDisplay(date: string, timezone: string): string {
  return formatSpokenDate(localToUTC(date, 12, 0, timezone), timezone);
}

function getAppointmentServiceIds(appointment: AiManagedAppointment): string[] {
  if (appointment.serviceIds.length > 0) return appointment.serviceIds;
  return appointment.serviceId ? [appointment.serviceId] : [];
}

function buildRescheduleTargets(
  appointments: AiManagedAppointment[],
  requestedStart: Date
): AppointmentRescheduleTarget[] {
  const sortedAppointments = [...appointments].sort(
    (left, right) => left.startTime.getTime() - right.startTime.getTime()
  );
  const nextStartByStaff = new Map<string, Date>();

  return sortedAppointments.map((appointment) => {
    let start = requestedStart;

    if (appointment.staffId) {
      const reservedStart = nextStartByStaff.get(appointment.staffId);
      if (reservedStart) {
        start = reservedStart;
      }
    }

    const end = new Date(start.getTime() + appointment.duration * 60_000);

    if (appointment.staffId) {
      nextStartByStaff.set(appointment.staffId, end);
    }

    return {
      appointment,
      start,
      end,
    };
  });
}

async function findCustomerIdsForPhone(businessId: string, phone: string): Promise<string[]> {
  const matchClauses = buildCustomerPhoneMatchClauses(phone);
  if (matchClauses.length === 0) return [];

  const customers = await prisma.customer.findMany({
    where: {
      businessId,
      OR: matchClauses,
    },
    select: { id: true },
  });

  return customers.map((customer) => customer.id);
}

async function findMatchedCustomersByPhone(
  businessId: string,
  phone: string,
  take = 5
): Promise<MatchedCustomerRecord[]> {
  const matchClauses = buildCustomerPhoneMatchClauses(phone);
  if (matchClauses.length === 0) return [];

  return prisma.customer.findMany({
    where: {
      businessId,
      OR: matchClauses,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      phoneLookupKey: true,
    },
    orderBy: { createdAt: 'asc' },
    take,
  });
}

async function findSingleMatchedCustomerByPhone(
  businessId: string,
  phone: string
): Promise<MatchedCustomerRecord | null> {
  const customers = await findMatchedCustomersByPhone(businessId, phone, 2);
  return customers.length === 1 ? customers[0] : null;
}

async function resolveRequestedServices(
  businessId: string,
  args: any
): Promise<ResolvedServiceSelection | null> {
  const serviceIds = getRequestedServiceIds(args);
  if (serviceIds.length === 0) return null;

  const services = await prisma.service.findMany({
    where: {
      id: { in: serviceIds },
      businessId,
      active: true,
    },
    select: {
      id: true,
      name: true,
      duration: true,
    },
  });

  if (services.length !== serviceIds.length) return null;

  const servicesById = new Map(services.map((service) => [service.id, service]));
  const orderedServices = serviceIds
    .map((serviceId) => servicesById.get(serviceId))
    .filter(
      (service): service is { id: string; name: string; duration: number } => Boolean(service)
    );

  return {
    primaryServiceId: serviceIds[0],
    serviceIds,
    services: orderedServices,
    totalDuration: orderedServices.reduce((sum, service) => sum + service.duration, 0),
    spokenLabel: formatServiceList(orderedServices.map((service) => service.name)),
  };
}

// ─── Assistant config builder ─────────────────────────────────────────────────

function buildAssistantConfig(business: BusinessData) {
  const appUrl = getConfiguredAppBaseUrl();
  const webhookBaseUrl = getConfiguredWebhookBaseUrl();
  const forwardingPhoneNumber = normalizeOptionalPhoneNumber(business.aiReceptionistPhone);

  if (business.aiReceptionistPhone && !forwardingPhoneNumber) {
    console.warn(`[vapi] Ignoring invalid forwarding phone number for business ${business.id}`);
  }

  // Give the AI the actual current date so it doesn't hallucinate past dates
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-US', {
    timeZone: business.timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const todayISO = now.toLocaleDateString('en-CA', { timeZone: business.timezone }); // YYYY-MM-DD

  const servicesList = business.services.length > 0
    ? business.services.map(s => {
        const price = s.price ? `$${s.price}` : 'price varies';
        return `- ${s.name} (ID: ${s.id}, ${s.duration} min, ${price})`;
      }).join('\n')
    : 'Services not listed. Please ask for more details.';

  const hoursText = formatBusinessHours(business.businessHours?.hours);
  const closureText = formatSpecialClosures(business.closureDates, business.timezone);
  const location = [business.street, business.city, business.state].filter(Boolean).join(', ') || 'Location not listed.';
  const bookingUrl = `${appUrl}/book/${business.publicId}`;

  const staffList = business.staff.length > 0
    ? business.staff
        .map((staffMember) =>
          `- ${staffMember.fullName} (ID: ${staffMember.id}${staffMember.role !== 'staff' ? `, ${staffMember.role}` : ''}, ${formatStaffAvailabilitySummary({
            workDays: staffMember.workDays,
            workHours: staffMember.workHours,
            businessHours: business.businessHours?.hours,
          })})`
        )
        .join('\n')
    : null;

  const faqList = (Array.isArray(business.aiReceptionistFaq) ? business.aiReceptionistFaq as { question: string; answer: string }[] : []).filter(f => f.question && f.answer);
  const faqText = faqList.length > 0
    ? '\nFrequently asked questions:\n' + faqList.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')
    : '';
  const languageSelectionMode = business.aiReceptionistSpanishEnabled ? 'spoken-digits' as const : 'speech-only' as const;

  const languageInstructions = business.aiReceptionistSpanishEnabled
    ? `
Language handling:
- You are fully bilingual in English and Spanish.
- The first message already offers the caller an English or Spanish choice: "${getAiReceptionistSelectionPrompt(business.name, { mode: languageSelectionMode })}"
- If the caller says "English", "Spanish", "one", "two", "espanol", or "ingles", treat that as the language choice immediately.
- As soon as the caller picks a language, acknowledge it in one very short sentence before helping them. Example: "Okay, English." or "Perfecto, espanol."
- If the caller answers in Spanish or asks for Spanish, continue entirely in Spanish for the rest of the call unless they later ask to switch.
- If the caller answers in English, continue entirely in English.
- If the caller skips the selector and starts asking for help right away, infer the language from what they say and continue in that language.
- After the language is clear, do not keep repeating the bilingual selector.`
    : `
Language handling:
- Respond entirely in English for this call.`;

  const systemPrompt = `You are the AI receptionist for ${business.name}, a ${business.businessType}.

Today is ${todayStr} (${todayISO}). Always use this date when the caller says "today", "tomorrow", etc.

Business hours:
${hoursText}

Specific closed dates:
${closureText}

Services offered (use the ID field when calling tools, never say the ID aloud):
${servicesList}
${staffList ? `\nOur team (use the ID field when calling tools, never say the ID aloud):\n${staffList}\n` : ''}
Location: ${location}
Online booking: ${bookingUrl}${faqText}
${languageInstructions}

Your job:
- If asked about hours, location, services, prices, or staff: answer directly from the information above and do NOT call any tools for these questions
- Only answer a factual business question when the answer is explicitly supported by the information above. If it is not listed above, do not infer, assume, or make it up.
- For any question outside the information above, clearly say you do not have that information and ask whether they would like to be transferred to someone who might be able to help.
- If a caller asks about a listed special closure date, tell them the business is closed that day.
- If the caller asks whether a staff member works on a specific day or time, answer from the team availability above. Never say someone is available outside the listed days or hours.
- If the caller asks for a staff member who is not listed on the team, say you could not find them on the team, do not guess, and ask if they would like to be transferred to someone who might be able to help.
- Questions about whether the business is for sale, whether someone can buy the business, ownership changes, manager decisions, employment decisions, or any policy not explicitly listed above are unknown questions. Do not answer them yourself. Say you do not have that information and ask if they would like to be transferred to someone who might be able to help.
- Whenever you say a date out loud, always use the full weekday and full month name, like "Saturday, March 28" instead of abbreviations like "Sat Mar 28."
- If the caller wants to BOOK a new appointment (phrases like "I want to book", "I'd like to schedule", "make an appointment", "I want an appointment", "can I get an appointment"):
  - Collect the following before calling checkAvailability — but if the caller already told you some or all of these upfront, skip asking and use what they gave you:
    1. Which service or services they want in the same visit
    2. Whether they prefer a specific staff member (skip if they didn't mention one)
    3. Their preferred date and time
  - The maximum is 5 services in one appointment. If they ask for more than 5, help them narrow it down to 5 for that visit before calling any booking tool.
  - If the caller wants multiple services in one visit, you MUST keep them in one combined appointment. Do NOT split them into separate bookings unless the caller explicitly asks for separate visits.
  - Once a caller names a specific staff member, keep that same staffId on every later manage_booking call until the caller changes staff or says anyone is fine.
  - Once you have the service selection + date (and optionally time and staff), call manage_booking with action "checkAvailability" — include date, serviceIds for every requested service in the same appointment, and optionally requestedTime and staffId. Only use serviceId by itself when there is exactly one service.
  - If the requested time is available and the caller phone number already matches exactly one customer, say the time back and ask "I have your name as [first name]. Is that right?" Do not ask for a brand-new name in that case.
  - If the requested time is available and the caller phone number does not match exactly one customer, ask what name to put the appointment under.
    If the time is taken, present the 3 closest alternatives and ask which they prefer, then get their name
    If no specific time was given, present the options and ask which they'd like, then get their name
    If the tool says the staff member is off that day, outside their working hours, unavailable, or not found, do not keep offering that same staff member as available.
  - Once you have service selection, time, and name or confirmed stored name: read back a brief summary to confirm — e.g. "Got it — [services] on [day] at [time] for [name]. Shall I go ahead and book that?" — wait for the caller to confirm (yes/correct/go ahead/etc.) before calling createBooking. If they correct anything, update accordingly and confirm again before booking.
  - After they confirm: call manage_booking with action "createBooking" with serviceIds for every requested service in the same appointment, slotTime (exact ISO from checkAvailability result, the value in parentheses), customerName only when you need to override or supply a name, and staffId if applicable. Only use serviceId by itself when there is exactly one service. If the caller mentioned anything special at any point (e.g. "it's my birthday", "I'm allergic to lavender", "please have soft music"), include it as the notes field — do not ask for it. Do NOT call createBooking until you have confirmation from the caller.
  - The tool confirms the booking — relay the confirmation to the caller and always ask "Is there anything else I can help you with?"
  - Wait for their response before ending the call. If they say no (or "nope", "that's all", "I'm good", etc.), say the exact phrase: "Happy to help! Have a wonderful day — goodbye!" then call end_call
- If they want to VIEW or CANCEL an existing appointment (phrases like "check my appointment", "what's my appointment", "I need to cancel", "cancel my booking"): call manage_booking with action "getAppointments" to show their upcoming bookings, then ask which one to cancel, then call "cancelAppointment" with the appointmentId — never say the appointmentId aloud
- If they want to RESCHEDULE or REBOOK an existing appointment, call manage_booking with action "getAppointments" first if you do not already have the appointment IDs, then call "updateAppointment" with the selected appointmentId or appointmentIds plus the new slotTime. Never cancel an appointment just to move it to a new day or time.
- If the caller wants to move multiple appointments at once, pass every selected appointment ID together in appointmentIds. If those appointments are with the same specific staff member, the tool will keep them back to back starting from the requested time.
- If they want to UPDATE an existing appointment's name or notes instead of the time, call "updateAppointment" with the appointmentId or appointmentIds and the field(s) to change (customerName and/or notes) — never say the appointmentId aloud
- If they say "talk to a person", "real person", "human", "manager", or similar, say exactly: "Let me connect you now." Then immediately call transferCall. Do not ask more questions first.
- When the caller signals they are done (says "goodbye", "bye", "that's all", "I'm good", "no", "nope", "nothing else", or similar), you MUST say the exact phrase: "Happy to help! Have a wonderful day — goodbye!" — then immediately call end_call. Do NOT just say "Goodbye!" alone.
- Never end the call without first saying that exact closing phrase.
- Before calling a tool, say one short natural phrase — vary it each time and match it to the situation. Examples: "Let me check that.", "Let me see what's open.", "Let me look at the schedule.", "Let me get that booked for you.", "Let me lock that in.", "Let me pull that up.", "One moment.", "Sure, let me grab that." — never repeat the same phrase twice in a row. If you need to call two tools back-to-back (e.g. getAppointments then cancelAppointment), say the phrase only once before the first tool — do NOT say another phrase between them
- Keep ALL responses under 2 sentences — this is a phone call, be brief
- Be warm and professional
- If you don't know the answer and a transfer destination is configured, do not guess. First say you do not have that information and ask if they would like to be transferred to someone who might be able to help. If they say yes, say exactly: "Let me connect you now." Then immediately call transferCall.
- If you don't know the answer and no forwarding phone number is configured, say "Let me take a message for the team."
- Never read service IDs or appointment IDs aloud; they are internal references only`;

  return {
    name: `${business.name} Receptionist`,
    firstMessage: getAiReceptionistVoiceGreeting(
      business.name,
      business.aiReceptionistGreeting,
      business.aiReceptionistSpanishEnabled,
      { mode: languageSelectionMode },
    ),
    hooks: business.aiReceptionistSpanishEnabled
      ? [
          {
            on: 'assistant.speech.interrupted',
            do: [
              {
                type: 'say',
                exact: ['Go ahead.', 'Sure, go ahead.', 'Okay, go ahead.'],
              },
            ],
          },
          {
            on: 'customer.speech.timeout',
            options: {
              timeoutSeconds: 6,
              triggerMaxCount: 1,
              triggerResetMode: 'onUserSpeech',
            },
            do: [
              {
                type: 'say',
                exact: getAiReceptionistSelectionReminder({ mode: languageSelectionMode }),
              },
            ],
            name: 'language_selector_follow_up',
          },
        ]
      : undefined,
    model: {
      provider: 'openai',
      model: 'gpt-5.2',
      temperature: 0.4,
      messages: [{ role: 'system', content: systemPrompt }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'manage_booking',
            description: 'Manage appointments: check availability, book, view existing, or cancel.',
            parameters: {
              type: 'object',
              properties: {
                action: {
                  type: 'string',
                  enum: ['checkAvailability', 'createBooking', 'getAppointments', 'cancelAppointment', 'updateAppointment'],
                  description: 'checkAvailability: list open slots. createBooking: book an appointment. getAppointments: show caller\'s upcoming appointments. cancelAppointment: cancel a specific appointment. updateAppointment: reschedule or update one or more existing appointments.',
                },
                date: {
                  type: 'string',
                  description: 'Date in YYYY-MM-DD format — REQUIRED for checkAvailability; omit for other actions',
                },
                requestedTime: {
                  type: 'string',
                  description: 'Specific time the caller asked for, e.g. "3 PM" or "10:30 AM" — OPTIONAL for checkAvailability. If provided, checks that exact slot and returns the 3 closest alternatives if taken.',
                },
                serviceId: {
                  type: 'string',
                  description: 'Legacy single-service ID from the services list. Use this only when there is exactly one service in the appointment.',
                },
                serviceIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Preferred for checkAvailability and createBooking. Include every service ID for the same appointment, in the order the caller requested them. Maximum 5 services per appointment.',
                },
                staffId: {
                  type: 'string',
                  description: 'Staff member ID — OPTIONAL for checkAvailability and createBooking; only include if the caller requested a specific staff member',
                },
                slotTime: {
                  type: 'string',
                  description: 'ISO 8601 UTC datetime of the chosen slot — required for createBooking',
                },
                customerName: {
                  type: 'string',
                  description: "Caller's name — first name is fine. Optional for createBooking when the caller phone already matches one saved customer. Optional for updateAppointment when changing the saved customer name.",
                },
                notes: {
                  type: 'string',
                  description: "Any special requests or notes from the caller — OPTIONAL for createBooking, e.g. 'birthday celebration', 'first time visitor', 'allergic to lavender'",
                },
                appointmentId: {
                  type: 'string',
                  description: 'Single appointment ID for cancelAppointment or updateAppointment.',
                },
                appointmentIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Use this for updateAppointment when the caller wants to change multiple appointments at once.',
                },
              },
              required: ['action'],
            },
          },
        },
        ...(forwardingPhoneNumber
          ? [
              {
                type: 'transferCall',
                destinations: [
                  {
                    type: 'number',
                    number: forwardingPhoneNumber,
                    message: 'I am forwarding your call now. Please stay on the line.',
                  },
                ],
              },
            ]
          : []),
        { type: 'endCall' },
      ],
    },
    server: {
      url: `${webhookBaseUrl}/api/webhooks/vapi`,
    },
    transcriber: {
      provider: 'deepgram',
      model: 'nova-2',
      language: business.aiReceptionistSpanishEnabled ? 'multi' : 'en',
    },
    voice: {
      provider: '11labs',
      voiceId: 'NDjuUGBKZhdOwAYMSat7', // Custom voice
      stability: 0.45,
      similarityBoost: 0.75,
    },
    startSpeakingPlan: {
      waitSeconds: 0.9,
    },
    stopSpeakingPlan: {
      numWords: 0,
      voiceSeconds: 0.2,
      backoffSeconds: 1,
    },
    voicemailDetection: {
      provider: 'vapi',
    },
    voicemailMessage: getAiReceptionistVoicemailMessage(
      business.name,
      bookingUrl,
      business.aiReceptionistSpanishEnabled,
    ),
    silenceTimeoutSeconds: 60,
  };
}

function replaceLanguageHandlingSection(
  systemPrompt: string,
  languageInstructions: string
): string {
  const languageSectionPattern = /Language handling:[\s\S]*?\n\nYour job:/;
  return systemPrompt.replace(
    languageSectionPattern,
    `${languageInstructions}\n\nYour job:`
  );
}

function buildKeypadLanguageSelectionWorkflow(business: BusinessData) {
  const assistant = buildAssistantConfig(business);
  const systemPrompt = assistant.model.messages[0]?.content;

  if (typeof systemPrompt !== 'string') {
    throw new Error('AI receptionist workflow prompt is missing');
  }

  const englishSupportPrompt = replaceLanguageHandlingSection(
    systemPrompt,
    `Language handling:
- Respond entirely in English for this call.
- The caller already chose English from the phone menu.
- Do not repeat the bilingual menu once the call is in this support path.`
  );

  const spanishSupportPrompt = replaceLanguageHandlingSection(
    systemPrompt,
    `Language handling:
- Respond entirely in Spanish for this call.
- The caller already chose Spanish from the phone menu.
- Do not repeat the bilingual menu once the call is in this support path.`
  );

  const baseConversationModel = {
    provider: assistant.model.provider,
    model: assistant.model.model,
    temperature: assistant.model.temperature,
  };

  return {
    name: `${business.name} Receptionist Workflow`,
    server: assistant.server,
    keypadInputPlan: {
      enabled: true,
      delimiters: [''],
      timeoutSeconds: 2,
    },
    nodes: [
      {
        name: 'language_selection',
        type: 'conversation',
        isStart: true,
        model: {
          ...baseConversationModel,
          temperature: 0.2,
        },
        transcriber: {
          provider: 'deepgram',
          model: 'nova-2',
          language: 'multi',
        },
        voice: assistant.voice,
        messagePlan: {
          firstMessage: getAiReceptionistSelectionPrompt(business.name, { mode: 'dtmf' }),
        },
        prompt: `You are helping the caller choose English or Spanish for ${business.name}.
- English, one, or 1 means english.
- Espanol, Spanish, dos, two, or 2 means spanish.
- If the choice is unclear, calmly repeat the options and wait again.
- Extract only the caller's language choice as preferred_language.`,
        variableExtractionPlan: {
          output: [
            {
              type: 'string',
              title: 'preferred_language',
              description: 'Caller preferred language for this call',
              enum: ['english', 'spanish'],
            },
          ],
        },
      },
      {
        name: 'english_support',
        type: 'conversation',
        model: baseConversationModel,
        tools: assistant.model.tools,
        transcriber: {
          provider: 'deepgram',
          model: 'nova-2',
          language: 'en',
        },
        voice: assistant.voice,
        messagePlan: {
          firstMessage: 'Okay, English. How can I help you today?',
        },
        prompt: englishSupportPrompt,
      },
      {
        name: 'spanish_support',
        type: 'conversation',
        model: baseConversationModel,
        tools: assistant.model.tools,
        transcriber: {
          provider: 'deepgram',
          model: 'nova-2',
          language: 'multi',
        },
        voice: assistant.voice,
        messagePlan: {
          firstMessage: 'Perfecto, espanol. Como puedo ayudarle hoy?',
        },
        prompt: spanishSupportPrompt,
      },
    ],
    edges: [
      {
        from: 'language_selection',
        to: 'english_support',
        condition: {
          type: 'logic',
          liquid: '{{ preferred_language == "english" }}',
        },
      },
      {
        from: 'language_selection',
        to: 'spanish_support',
        condition: {
          type: 'logic',
          liquid: '{{ preferred_language == "spanish" }}',
        },
      },
    ],
  };
}

// ─── Tool: checkAvailability ──────────────────────────────────────────────────

async function findAiBusinessByPhoneNumberId(phoneNumberId: string): Promise<BusinessData | null> {
  return prisma.business.findFirst({
    where: { vapiPhoneNumberId: phoneNumberId, aiReceptionistEnabled: true },
    select: AI_ENABLED_BUSINESS_SELECT,
  });
}

async function syncCallSessionFromConversationUpdate(body: any): Promise<void> {
  const phoneNumberId =
    body?.message?.phoneNumber?.id ?? body?.message?.call?.phoneNumberId;
  const callId = body?.message?.call?.id;

  if (!phoneNumberId || !callId) return;

  const business = await findAiBusinessByPhoneNumberId(phoneNumberId);
  if (!business) return;

  const conversation = Array.isArray(body?.message?.conversation)
    ? body.message.conversation as CallConversationMessage[]
    : [];
  const staffSignal = inferStaffPreferenceFromConversation(conversation, business.staff);

  if (!staffSignal) return;

  const callerPhone =
    typeof body?.message?.call?.customer?.number === 'string'
      ? normalizeOptionalStoredPhoneNumber(body.message.call.customer.number)
      : null;

  const data =
    staffSignal.kind === 'set'
      ? {
          requestedStaffId: staffSignal.staffId,
          requestedStaffName: staffSignal.staffName,
        }
      : staffSignal.kind === 'unknown'
        ? {
            requestedStaffId: null,
            requestedStaffName: staffSignal.staffName,
          }
        : {
            requestedStaffId: null,
            requestedStaffName: null,
          };

  await prisma.aiCallSession.upsert({
    where: { callId },
    update: {
      callerPhone,
      ...data,
    },
    create: {
      businessId: business.id,
      callId,
      callerPhone,
      ...data,
    },
  });
}

async function clearCallSession(body: any): Promise<void> {
  const callId = body?.message?.call?.id;
  if (!callId) return;

  await prisma.aiCallSession.deleteMany({
    where: { callId },
  });
}

function canSendAppointmentRequestSms(customer: {
  phone: string | null;
  smsConsent: boolean;
  smsOptedOut: boolean;
}) {
  return Boolean(customer.phone) && customer.smsConsent && !customer.smsOptedOut;
}

async function resolveAiManagedAppointmentServiceName(appointment: AiManagedAppointment) {
  if (!appointment.serviceIds.length) {
    return appointment.service?.name ?? 'Appointment';
  }

  const services = await prisma.service.findMany({
    where: { id: { in: appointment.serviceIds } },
    select: { id: true, name: true },
  });

  return (
    resolveAppointmentServiceDisplayName(
      {
        serviceIds: appointment.serviceIds,
        service: appointment.service ? { name: appointment.service.name } : undefined,
      },
      services,
    ) ?? appointment.service?.name ?? 'Appointment'
  );
}

async function sendAiAppointmentRequestConfirmation(params: {
  appointmentId: string;
  phone: string;
  customerName: string;
  serviceName: string;
  staffName: string;
  dateTime: Date;
  duration: number;
  shortId: string | null;
  business: Pick<BusinessData, 'name' | 'timezone' | 'vapiPhoneNumber'>;
}) {
  const appUrl = getConfiguredAppBaseUrl();
  const appointmentUrl = params.shortId ? `${appUrl}/a/${params.shortId}` : undefined;
  const smsResult = await sendAppointmentConfirmation(params.phone, {
    customerName: params.customerName,
    serviceName: params.serviceName,
    staffName: params.staffName,
    dateTime: params.dateTime,
    businessName: params.business.name,
    duration: params.duration,
    timezone: params.business.timezone,
    appointmentUrl,
    senderPhone: params.business.vapiPhoneNumber,
  });

  if (!smsResult.success) {
    console.error('[vapi] immediate appointment request SMS failed:', smsResult.error);
    return false;
  }

  await prisma.appointment.update({
    where: { id: params.appointmentId },
    data: { confirmationSent: true },
  });
  return true;
}

async function sendGroupedAiAppointmentConfirmationForEndedCall(body: any): Promise<void> {
  const phoneNumberId =
    body?.message?.phoneNumber?.id ?? body?.message?.call?.phoneNumberId;
  const callId = body?.message?.call?.id;
  const callerPhone = normalizeOptionalStoredPhoneNumber(body?.message?.call?.customer?.number);

  if (!phoneNumberId || !callId || !callerPhone) return;

  const business = await findAiBusinessByPhoneNumberId(phoneNumberId);
  if (!business) return;

  const callSession = await prisma.aiCallSession.findUnique({
    where: { callId },
    select: { createdAt: true },
  });

  const window = getBufferedAppointmentBatchWindow(
    callSession?.createdAt ?? new Date(Date.now() - 20 * 60 * 1000),
    new Date()
  );

  const appointmentsNeedingConfirmation = await prisma.appointment.findMany({
    where: {
      ...buildAiAppointmentBatchWhereInput(business.id, callerPhone, window.startMs, window.endMs),
      confirmationSent: false,
    },
    select: {
      id: true,
      customer: { select: { name: true } },
    },
    orderBy: { startTime: 'asc' },
    take: 20,
  });

  if (appointmentsNeedingConfirmation.length === 0) return;

  const appUrl = getConfiguredAppBaseUrl();
  const token = createAppointmentBatchToken({
    b: business.id,
    p: callerPhone,
    s: window.startMs,
    e: window.endMs,
  });
  const confirmationUrl = `${appUrl}/a/${encodeURIComponent(token)}`;

  const result = await sendAppointmentBatchConfirmation(callerPhone, {
    customerName: appointmentsNeedingConfirmation[0].customer?.name || 'there',
    businessName: business.name,
    appointmentCount: appointmentsNeedingConfirmation.length,
    appointmentUrl: confirmationUrl,
    senderPhone: business.vapiPhoneNumber,
  });

  if (!result.success) {
    console.error('[vapi] grouped appointment SMS send failed:', result.error);
    return;
  }

  await prisma.appointment.updateMany({
    where: {
      id: {
        in: appointmentsNeedingConfirmation.map((appointment) => appointment.id),
      },
    },
    data: {
      confirmationSent: true,
    },
  });
}

async function resolveRequestedStaffContext(
  business: BusinessData,
  callId: string | null,
  rawStaffId: string | null
): Promise<{ staffId: string | null; missingStaffName: string | null }> {
  if (rawStaffId) {
    return { staffId: rawStaffId, missingStaffName: null };
  }

  if (!callId) {
    return { staffId: null, missingStaffName: null };
  }

  const session = await prisma.aiCallSession.findUnique({
    where: { callId },
    select: {
      requestedStaffId: true,
      requestedStaffName: true,
    },
  });

  if (!session) {
    return { staffId: null, missingStaffName: null };
  }

  if (session.requestedStaffId) {
    const matchingStaff = business.staff.find((staffMember) => staffMember.id === session.requestedStaffId);
    return {
      staffId: matchingStaff?.id ?? null,
      missingStaffName: matchingStaff ? null : session.requestedStaffName ?? null,
    };
  }

  return {
    staffId: null,
    missingStaffName: session.requestedStaffName ?? null,
  };
}

async function handleCheckAvailability(
  business: BusinessData,
  args: any,
  callId: string | null,
  callerPhone: string
): Promise<string> {
  const { date } = args;
  const rawStaffId = typeof args?.staffId === 'string' ? args.staffId : null;
  if (!date) return 'Please specify a date to check availability.';
  const closure = findBusinessClosureForDate(date, business.closureDates);
  if (closure) return `${describeBusinessClosure(closure)} Would you like a different day?`;
  if (getRequestedServiceIds(args).length > MAX_VAPI_APPOINTMENT_SERVICES) {
    return getTooManyServicesMessage();
  }
  const serviceSelection = await resolveRequestedServices(business.id, args);
  if (!serviceSelection) return 'Please specify a valid service.';
  const requestedDateDisplay = getRequestedDateDisplay(date, business.timezone);
  const matchedCustomer = callerPhone
    ? await findSingleMatchedCustomerByPhone(business.id, callerPhone)
    : null;

  const { staffId, missingStaffName } = await resolveRequestedStaffContext(
    business,
    callId,
    rawStaffId
  );
  if (missingStaffName) {
    return `I couldn't find ${missingStaffName} on the team. Would you like someone else?`;
  }

  const hoursData = normalizeBusinessHoursRecord(business.businessHours?.hours);
  const dayOfWeek = weekdayIndexForLocalDate(date, business.timezone);
  const hours = hoursData[dayOfWeek];

  if (!hours?.isOpen || !hours.openTime || !hours.closeTime) return `We're closed on ${requestedDateDisplay}.`;

  let openTime = hours.openTime;
  let closeTimeLabel = hours.closeTime;

  if (staffId) {
    const staffValidation = await validateBookableStaffSelection({
      staffId,
      businessId: business.id,
      serviceIds: serviceSelection.serviceIds,
      dayOfWeek,
      businessHours: hoursData,
      timezone: business.timezone,
    });
    if (staffValidation?.reason === 'staff_off_day') {
      return `${staffValidation.error} Would you like to pick a different day or a different staff member?`;
    }
    if (staffValidation?.reason === 'staff_cant_do_service') {
      return 'That staff member cannot do all of those services in one appointment. Would you like a different staff member?';
    }
    if (staffValidation?.reason === 'staff_not_found') {
      return 'I could not find that staff member. Would you like someone else from the team?';
    }

    const staffMember =
      await prisma.staff.findFirst({
        where: { id: staffId, businessId: business.id, active: true },
        select: {
          id: true,
          fullName: true,
          workDays: true,
          workHours: true,
        },
      }) ?? business.staff.find((member) => member.id === staffId);
    if (staffMember) {
      const staffHours = getEffectiveStaffDayHours({
        dayOfWeek,
        workDays: staffMember.workDays,
        workHours: staffMember.workHours,
        businessHours: hoursData,
      });

      if (!staffHours.worksDay) {
        return `${staffMember.fullName} doesn't work on that day. Would you like to pick a different day or a different staff member?`;
      }

      if (!staffHours.startTime || !staffHours.endTime) {
        return `${staffMember.fullName} is unavailable on that day. Would you like a different day or staff member?`;
      }

      openTime = staffHours.startTime;
      closeTimeLabel = staffHours.endTime;
    }
  }

  const startOfDay = businessTimeToUTC(date, 0, 0, business.timezone);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      businessId: business.id,
      status: { in: ['pending', 'scheduled', 'confirmed'] },
      startTime: { gte: startOfDay, lte: endOfDay },
      ...(staffId && { staffId }),
    },
    select: { startTime: true, endTime: true },
  });

  const closeTime = businessTimeToUTC(
    date,
    Number.parseInt(closeTimeLabel.slice(0, 2), 10),
    Number.parseInt(closeTimeLabel.slice(3, 5), 10),
    business.timezone
  );
  const now = new Date();
  const slots: string[] = [];

  const timeOptions = buildAppointmentStartOptions(openTime, closeTimeLabel, serviceSelection.totalDuration);

  for (const timeValue of timeOptions) {
    const slotTime = businessTimeToUTC(
      date,
      Number.parseInt(timeValue.slice(0, 2), 10),
      Number.parseInt(timeValue.slice(3, 5), 10),
      business.timezone
    );
    const slotEndTime = new Date(slotTime.getTime() + serviceSelection.totalDuration * 60000);
    if (slotEndTime > closeTime) continue;
    if (slotTime < now) continue;

    // Only filter by conflicts when a specific staff member was requested
    const hasConflict = staffId && existingAppointments.some(apt => {
      const aptStart = new Date(apt.startTime);
      const aptEnd = new Date(apt.endTime);
      return (
        (slotTime >= aptStart && slotTime < aptEnd) ||
        (slotEndTime > aptStart && slotEndTime <= aptEnd) ||
        (slotTime <= aptStart && slotEndTime >= aptEnd)
      );
    });

    if (!hasConflict) slots.push(slotTime.toISOString());
  }

  if (slots.length === 0) {
    return `No available slots on ${requestedDateDisplay} for ${serviceSelection.spokenLabel}.`;
  }

  function slotLabel(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: business.timezone,
    });
  }

  const { requestedTime } = args;

  if (requestedTime) {
    const parsed = parseTimeString(requestedTime);
    if (!parsed) return `I didn't catch that time — what time were you thinking?`;

    const requestedSlot = businessTimeToUTC(date, parsed.hour, parsed.minute, business.timezone);
    const requestedISO = requestedSlot.toISOString();

    if (slots.includes(requestedISO)) {
      const label = slotLabel(requestedISO);
      return `${label} is available for ${serviceSelection.spokenLabel} on ${requestedDateDisplay}. Slot: ${label} (${requestedISO}). ${getKnownCallerConfirmationPrompt(matchedCustomer)}`;
    }

    // Not available — return 3 closest available times
    const closest = slots
      .map(iso => ({ iso, diff: Math.abs(new Date(iso).getTime() - requestedSlot.getTime()) }))
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 3)
      .map(({ iso }) => `${slotLabel(iso)} (${iso})`);

    const requestedLabel = slotLabel(requestedISO);
    return `Sorry, ${requestedLabel} isn't available. The closest times I have are: ${closest.join(', ')}. Which works for you?`;
  }

  // No specific time — return first 4 with ISOs for the AI
  const firstFour = slots.slice(0, 4).map(iso => `${slotLabel(iso)} (${iso})`);
  const extra = slots.length > 4 ? ` and ${slots.length - 4} more` : '';
  const spokenTimes = firstFour.map(s => s.split(' (')[0]);
  return `Available for ${serviceSelection.spokenLabel} on ${requestedDateDisplay}: ${spokenTimes.join(', ')}${extra}. All slots: ${firstFour.join(', ')}. Which time works for you?`;
}

// ─── Tool: createBooking ──────────────────────────────────────────────────────

async function handleCreateBooking(
  business: BusinessData,
  args: any,
  callerPhone: string,
  callId: string | null
): Promise<string> {
  const { slotTime, customerName: rawCustomerName, notes } = args;
  const rawStaffId = typeof args?.staffId === 'string' ? args.staffId : null;
  if (!slotTime) return 'I need the appointment time to book. Which slot works for you?';
  const start = new Date(slotTime);
  if (isNaN(start.getTime())) return 'Invalid time slot. Please check availability again.';
  const startDateKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: business.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(start);
  const closure = findBusinessClosureForDate(startDateKey, business.closureDates);
  if (closure) {
    return `${describeBusinessClosure(closure)} Please choose a different day or time.`;
  }
  if (getRequestedServiceIds(args).length > MAX_VAPI_APPOINTMENT_SERVICES) {
    return getTooManyServicesMessage();
  }
  const serviceSelection = await resolveRequestedServices(business.id, args);
  if (!serviceSelection) return 'I need the service to book.';
  const matchedCustomer = callerPhone
    ? await findSingleMatchedCustomerByPhone(business.id, callerPhone)
    : null;
  const customerName = getPreferredCustomerName(rawCustomerName, matchedCustomer);
  if (!customerName) return 'What name should I put this under?';

  const { staffId, missingStaffName } = await resolveRequestedStaffContext(
    business,
    callId,
    rawStaffId
  );
  if (missingStaffName) {
    return `I couldn't find ${missingStaffName} on the team. Please choose a listed team member or say anyone is fine.`;
  }

  const end = new Date(start.getTime() + serviceSelection.totalDuration * 60000);
  const businessHoursError = validateBusinessHoursForAppointment({
    startTime: start,
    endTime: end,
    timezone: business.timezone,
    businessHours: business.businessHours?.hours,
    closureDates: business.closureDates,
  });

  if (businessHoursError) {
    return `${businessHoursError.error} Please choose a different day or time.`;
  }

  if (staffId) {
    const staffValidation = await validateBookableStaffSelection({
      staffId,
      businessId: business.id,
      serviceIds: serviceSelection.serviceIds,
      dayOfWeek: weekdayIndexInTimeZone(start, business.timezone),
      businessHours: business.businessHours?.hours,
      timezone: business.timezone,
      startTime: start,
      endTime: end,
    });
    if (staffValidation?.reason === 'staff_off_day') {
      return `${staffValidation.error} Please choose a different day or staff member.`;
    }
    if (staffValidation?.reason === 'staff_outside_hours') {
      return `${staffValidation.error} Please choose a time inside those hours.`;
    }
    if (staffValidation?.reason === 'staff_cant_do_service') {
      return 'That staff member cannot do all of those services in one appointment. Please choose someone else.';
    }
    if (staffValidation?.reason === 'staff_not_found') {
      return 'I could not find that staff member. Please choose a different team member.';
    }
  }

  // Conflict check — only when a specific staff member was requested
  if (staffId) {
    const conflicts = await prisma.appointment.count({
      where: {
        businessId: business.id,
        staffId,
        status: { in: ['pending', 'scheduled', 'confirmed'] },
        OR: [
          { AND: [{ startTime: { lte: start } }, { endTime: { gt: start } }] },
          { AND: [{ startTime: { lt: end } }, { endTime: { gte: end } }] },
          { AND: [{ startTime: { gte: start } }, { endTime: { lte: end } }] },
        ],
      },
    });
    if (conflicts > 0) return 'That time was just taken — let me check what else is open. What date works for you?';
  }

  // Find or create customer first (outside the booking transaction — not race-sensitive)
  const phone = callerPhone || null;
  const phoneData = buildCustomerPhoneData(phone);
  const matchingCustomerIds = phone ? await findCustomerIdsForPhone(business.id, phone) : [];
  let customer =
    matchingCustomerIds.length > 0
      ? await prisma.customer.findUnique({ where: { id: matchingCustomerIds[0] } })
      : null;

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        businessId: business.id,
        name: customerName,
        phone: phoneData.phone || undefined,
        phoneLookupKey: phoneData.phoneLookupKey || undefined,
        smsConsent: !!phone, // caller provided phone to AI receptionist — implied consent
      },
    });
  } else {
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        name: customerName,
        ...(phoneData.phone
          ? {
              phone: phoneData.phone,
              phoneLookupKey: phoneData.phoneLookupKey,
            }
          : {}),
      },
    });
  }

  const shortId = Math.random().toString(36).substring(2, 9).toUpperCase();
  let createdAppointmentId: string | null = null;

  // Serializable transaction with one retry for Postgres serialization failures
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        // Only check for conflicts when a specific staff member was requested
        if (staffId) {
          const txConflicts = await tx.appointment.count({
            where: {
              businessId: business.id,
              staffId,
              status: { in: ['pending', 'scheduled', 'confirmed'] },
              OR: [
                { AND: [{ startTime: { lte: start } }, { endTime: { gt: start } }] },
                { AND: [{ startTime: { lt: end } }, { endTime: { gte: end } }] },
                { AND: [{ startTime: { gte: start } }, { endTime: { lte: end } }] },
              ],
            },
          });
          if (txConflicts > 0) throw new Error('SLOT_TAKEN');
        }

        const appointment = await tx.appointment.create({
          data: {
            businessId: business.id,
            customerId: customer!.id,
            serviceId: serviceSelection.primaryServiceId,
            serviceIds: serviceSelection.serviceIds,
            startTime: start,
            endTime: end,
            duration: serviceSelection.totalDuration,
            status: 'pending',
            shortId,
            source: 'ai',
            ...(staffId && { staffId }),
            ...(notes && { notes }),
          },
        });
        createdAppointmentId = appointment.id;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      break; // success — exit retry loop
    } catch (err: any) {
      if (err.message === 'SLOT_TAKEN') {
        return 'That time was just taken — let me check what else is open. What date works for you?';
      }
      if (isSerializationError(err) && attempt === 0) continue; // retry once
      throw err;
    }
  }

  const formattedTime = start.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: business.timezone,
  });

  const staffLine = staffId
    ? await prisma.staff.findFirst({ where: { id: staffId, businessId: business.id }, select: { fullName: true } })
    : null;
  const withWhom = staffLine ? ` with ${staffLine.fullName}` : '';

  // Create in-app notification for business
  await createBusinessNotification({
    businessId: business.id,
    type: 'new_appointment',
    title: 'New Booking via AI Receptionist',
    message: `${customerName} booked ${serviceSelection.spokenLabel}${withWhom} for ${formattedTime}`,
    link: '/dashboard/appointments',
    sendPush: business.notifyNewBookingEmail !== false,
  });

  if (callerPhone && createdAppointmentId) {
    const smsSent = await sendAiAppointmentRequestConfirmation({
      appointmentId: createdAppointmentId,
      phone: callerPhone,
      customerName,
      serviceName: serviceSelection.spokenLabel,
      staffName: staffLine?.fullName || 'our team',
      dateTime: start,
      duration: serviceSelection.totalDuration,
      shortId,
      business,
    });

    if (!smsSent && callId) {
      console.log(`[vapi] immediate request SMS failed, keeping grouped fallback for callId=${callId}`);
    }
  }

  return `Booking confirmed! ${customerName}, your ${serviceSelection.spokenLabel}${withWhom} is set for ${formattedTime}. ${business.name} will follow up shortly. Is there anything else I can help you with?`;
}

async function findManagedAppointmentsForCaller(
  business: BusinessData,
  callerPhone: string,
  appointmentIds: string[]
): Promise<AiManagedAppointment[] | null> {
  const customerIds = await findCustomerIdsForPhone(business.id, callerPhone);
  if (customerIds.length === 0) return null;

  const appointments = await prisma.appointment.findMany({
    where: {
      id: { in: appointmentIds },
      businessId: business.id,
      customerId: { in: customerIds },
      status: { in: ['pending', 'scheduled', 'confirmed'] },
    },
    include: {
      service: { select: { name: true } },
      staff: { select: { fullName: true } },
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          smsConsent: true,
          smsOptedOut: true,
        },
      },
    },
  });

  if (appointments.length !== appointmentIds.length) return null;

  const appointmentsById = new Map<string, AiManagedAppointment>(
    appointments.map((appointment) => [appointment.id, appointment as AiManagedAppointment])
  );
  return appointmentIds.reduce<AiManagedAppointment[]>((orderedAppointments, appointmentId) => {
    const appointment = appointmentsById.get(appointmentId);
    if (appointment) {
      orderedAppointments.push(appointment);
    }
    return orderedAppointments;
  }, []);
}

async function validateRescheduleTarget(
  business: BusinessData,
  target: AppointmentRescheduleTarget,
  excludedAppointmentIds: string[]
): Promise<string | null> {
  const businessHoursError = validateBusinessHoursForAppointment({
    startTime: target.start,
    endTime: target.end,
    timezone: business.timezone,
    businessHours: business.businessHours?.hours,
    closureDates: business.closureDates,
  });

  if (businessHoursError) {
    return `${businessHoursError.error} Please choose a different day or time.`;
  }

  if (!target.appointment.staffId) {
    return null;
  }

  const staffValidation = await validateBookableStaffSelection({
    staffId: target.appointment.staffId,
    businessId: business.id,
    serviceIds: getAppointmentServiceIds(target.appointment),
    dayOfWeek: weekdayIndexInTimeZone(target.start, business.timezone),
    businessHours: business.businessHours?.hours,
    timezone: business.timezone,
    startTime: target.start,
    endTime: target.end,
  });

  if (staffValidation?.reason === 'staff_off_day') {
    return `${staffValidation.error} Please choose a different day or staff member.`;
  }

  if (staffValidation?.reason === 'staff_outside_hours') {
    return `${staffValidation.error} Please choose a time inside those hours.`;
  }

  if (staffValidation?.reason === 'staff_cant_do_service') {
    return 'That staff member cannot do all of the services in that appointment. Please choose a different time or staff member.';
  }

  if (staffValidation?.reason === 'staff_not_found') {
    return 'I could not find that staff member. Please choose a different team member.';
  }

  const conflicts = await prisma.appointment.count({
    where: {
      businessId: business.id,
      staffId: target.appointment.staffId,
      status: { in: ['pending', 'scheduled', 'confirmed'] },
      id: { notIn: excludedAppointmentIds },
      startTime: { lt: target.end },
      endTime: { gt: target.start },
    },
  });

  if (conflicts > 0) {
    const staffName = target.appointment.staff?.fullName || 'that team member';
    const slotLabel = formatSpokenDateTime(target.start, business.timezone);
    return `${staffName} is not available at ${slotLabel}. Please choose a different time.`;
  }

  return null;
}

// ─── Tool: getAppointments ────────────────────────────────────────────────────

async function handleGetAppointments(business: BusinessData, callerPhone: string): Promise<string> {
  if (!callerPhone) return 'I need your phone number to look up your appointments.';
  const customerIds = await findCustomerIdsForPhone(business.id, callerPhone);
  if (customerIds.length === 0) return 'I don\'t see any upcoming appointments for your number.';

  const appointments = await prisma.appointment.findMany({
    where: {
      businessId: business.id,
      customerId: { in: customerIds },
      status: { in: ['pending', 'scheduled', 'confirmed'] },
      startTime: { gte: new Date() },
    },
    include: {
      service: { select: { name: true } },
      staff: { select: { fullName: true } },
    },
    orderBy: { startTime: 'asc' },
    take: 5,
  });

  if (appointments.length === 0) return 'I don\'t see any upcoming appointments for your number.';

  const list = appointments.map((apt, i) => {
    const time = formatSpokenDateTime(new Date(apt.startTime), business.timezone);
    const staffPart = apt.staff ? ` with ${apt.staff.fullName}` : '';
    return `${i + 1}. ${apt.service?.name ?? 'Appointment'}${staffPart} on ${time} (ID: ${apt.id})`;
  }).join('\n');

  return `Here are your upcoming appointments:\n${list}\n\nWhich one would you like to change or cancel?`;
}

// ─── Tool: updateAppointment ──────────────────────────────────────────────────

async function handleUpdateAppointment(business: BusinessData, args: any, callerPhone: string): Promise<string> {
  const appointmentIds = getRequestedAppointmentIds(args);
  const { customerName: rawCustomerName, notes, slotTime } = args;

  if (appointmentIds.length === 0) {
    return 'Which appointment would you like to update?';
  }

  const appointments = await findManagedAppointmentsForCaller(business, callerPhone, appointmentIds);
  if (!appointments || appointments.length === 0) {
    return "I couldn't find that appointment on your account.";
  }

  if (slotTime) {
    const requestedStart = new Date(slotTime);
    if (Number.isNaN(requestedStart.getTime())) {
      return 'I need a valid new date and time before I can move that appointment.';
    }

    const rescheduleTargets = buildRescheduleTargets(appointments, requestedStart);
    const excludedAppointmentIds = appointments.map((appointment) => appointment.id);

    for (const target of rescheduleTargets) {
      const validationError = await validateRescheduleTarget(
        business,
        target,
        excludedAppointmentIds
      );
      if (validationError) {
        return validationError;
      }
    }

    for (const target of rescheduleTargets) {
      if (
        canSendAppointmentRequestSms(target.appointment.customer) &&
        ['scheduled', 'confirmed'].includes(target.appointment.status)
      ) {
        const serviceName = await resolveAiManagedAppointmentServiceName(target.appointment);
        const appUrl = getConfiguredAppBaseUrl();
        const appointmentUrl = target.appointment.shortId
          ? `${appUrl}/a/${target.appointment.shortId}`
          : undefined;

        await cancelScheduledAppointmentReminder(target.appointment.customer.phone!, {
          customerName: target.appointment.customer.name,
          serviceName,
          staffName: target.appointment.staff?.fullName || 'our team',
          dateTime: target.appointment.startTime,
          businessName: business.name,
          appointmentUrl,
          timezone: business.timezone,
          senderPhone: business.vapiPhoneNumber,
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const target of rescheduleTargets) {
        await tx.appointment.update({
          where: { id: target.appointment.id },
          data: {
            startTime: target.start,
            endTime: target.end,
            status: 'pending',
            source: 'ai',
            confirmationSent: false,
            reminderSent: false,
            ...(notes !== undefined ? { notes } : {}),
          },
        });
      }
    });

    const firstTarget = rescheduleTargets[0];
    const targetTime = formatSpokenDateTime(firstTarget.start, business.timezone);
    const sameStaffIdSet = new Set(
      appointments.map((appointment) => appointment.staffId).filter(Boolean)
    );
    const runsBackToBack = appointments.length > 1 && sameStaffIdSet.size === 1;

    await createBusinessNotification({
      businessId: business.id,
      type: 'appointment_rescheduled',
      title: 'Appointments Rescheduled via AI Receptionist',
      message: `${appointments[0].customer.name} moved ${appointments.length} appointment${appointments.length === 1 ? '' : 's'} to start ${targetTime}.`,
      link: '/dashboard/appointments',
      sendPush: business.notifyNewBookingEmail !== false,
    });

    for (const target of rescheduleTargets) {
      if (!canSendAppointmentRequestSms(target.appointment.customer)) {
        continue;
      }

      const serviceName = await resolveAiManagedAppointmentServiceName(target.appointment);
      await sendAiAppointmentRequestConfirmation({
        appointmentId: target.appointment.id,
        phone: target.appointment.customer.phone!,
        customerName: target.appointment.customer.name,
        serviceName,
        staffName: target.appointment.staff?.fullName || 'our team',
        dateTime: target.start,
        duration: target.appointment.duration,
        shortId: target.appointment.shortId,
        business,
      });
    }

    return `Done — I moved ${appointments.length === 1 ? 'your appointment' : `all ${appointments.length} appointments`} to start ${targetTime}${runsBackToBack ? ' and kept the same-staff appointments back to back' : ''}. They are back in requested status for the business to review. Is there anything else I can help you with?`;
  }

  const resolvedCustomerName = getPreferredCustomerName(rawCustomerName, null);
  if (!resolvedCustomerName && notes === undefined) {
    return 'What would you like to change?';
  }

  const updates: string[] = [];

  if (resolvedCustomerName) {
    const customerIds = Array.from(new Set(appointments.map((appointment) => appointment.customer.id)));
    await prisma.customer.updateMany({
      where: { id: { in: customerIds } },
      data: { name: resolvedCustomerName },
    });
    updates.push(`name updated to ${resolvedCustomerName}`);
  }

  if (notes !== undefined) {
    await prisma.appointment.updateMany({
      where: { id: { in: appointmentIds } },
      data: { notes },
    });
    updates.push(appointmentIds.length === 1 ? 'notes updated' : 'notes updated on all selected appointments');
  }

  return `Done — your appointment has been updated: ${updates.join(', ')}. Is there anything else I can help you with?`;
}

// ─── Tool: cancelAppointment ──────────────────────────────────────────────────

async function handleCancelAppointment(business: BusinessData, args: any, callerPhone: string): Promise<string> {
  const { appointmentId } = args;
  if (!appointmentId) return 'Which appointment would you like to cancel?';
  const customerIds = await findCustomerIdsForPhone(business.id, callerPhone);
  if (customerIds.length === 0) return 'I couldn\'t find that appointment on your account.';

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      businessId: business.id,
      customerId: { in: customerIds },
      status: { in: ['pending', 'scheduled', 'confirmed'] },
    },
    include: { service: { select: { name: true } } },
  });

  if (!appointment) return 'I couldn\'t find that appointment on your account.';

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'cancelled' },
  });

  const time = formatSpokenDateTime(new Date(appointment.startTime), business.timezone);

  // Create in-app notification for business
  await prisma.notification.create({
    data: {
      businessId: business.id,
      type: 'appointment_cancelled',
      title: 'Appointment Cancelled via AI Receptionist',
      message: `${appointment.service?.name ?? 'Appointment'} on ${time} was cancelled by caller`,
      link: `/dashboard/appointments`,
    },
  });

  return `Done — your ${appointment.service?.name ?? 'appointment'} on ${time} has been cancelled.`;
}

// ─── Tool calls dispatcher ────────────────────────────────────────────────────

async function handleToolCalls(body: any): Promise<NextResponse> {
  const t0 = Date.now();
  const toolCallList: any[] = body?.message?.toolCallList ?? [];
  const phoneNumberId =
    body?.message?.phoneNumber?.id ?? body?.message?.call?.phoneNumberId;
  const callId: string | null = body?.message?.call?.id ?? null;
  const callerPhone =
    normalizeOptionalStoredPhoneNumber(body?.message?.call?.customer?.number ?? '') ?? '';

  const business = phoneNumberId ? await findAiBusinessByPhoneNumberId(phoneNumberId) : null;

  const results = await Promise.all(
    toolCallList.map(async (toolCall: any) => {
      const fnName: string = toolCall?.function?.name ?? '';
      const rawArgs = toolCall?.function?.arguments ?? {};
      const parsedArgs = parseToolArguments(rawArgs);
      const toolCallId: string = toolCall?.id ?? '';

      let result: string;
      let outcome = 'ok';
      try {
        if (!business) {
          result = 'Unable to access business information right now.';
          outcome = 'no_business';
        } else if (fnName === 'manage_booking') {
          const { action } = parsedArgs;
          if (action === 'checkAvailability') {
            result = await handleCheckAvailability(business, parsedArgs, callId, callerPhone);
          } else if (action === 'createBooking') {
            result = await handleCreateBooking(business, parsedArgs, callerPhone, callId);
            outcome = result.startsWith('Booking confirmed!') || result.startsWith('Done')
              ? 'booked'
              : 'conflict';
          } else if (action === 'getAppointments') {
            result = await handleGetAppointments(business, callerPhone);
          } else if (action === 'cancelAppointment') {
            result = await handleCancelAppointment(business, parsedArgs, callerPhone);
            outcome = result.startsWith('Done') ? 'cancelled' : 'cancel_failed';
          } else if (action === 'updateAppointment') {
            result = await handleUpdateAppointment(business, parsedArgs, callerPhone);
            outcome = result.startsWith('Done') ? 'updated' : 'update_failed';
          } else {
            result = 'Unknown action requested.';
            outcome = 'unknown_action';
          }
        } else {
          result = 'Unknown tool.';
          outcome = 'unknown_tool';
        }
      } catch (err: any) {
        console.error('Tool call error:', err);
        result = 'An error occurred processing your request.';
        outcome = 'error';
      }

      console.log(`[vapi] tool-call fn=${fnName} action=${parsedArgs?.action ?? '-'} outcome=${outcome} ms=${Date.now() - t0} bizId=${business?.id ?? 'unknown'}`);
      return { toolCallId, result };
    })
  );

  return NextResponse.json({ results });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // ── Debug: log every incoming Vapi request ────────────────────────────────
    const allHeaders: Record<string, string> = {};
    req.headers.forEach((v, k) => { allHeaders[k] = v; });
    let parsedForDebug: any = null;
    try { parsedForDebug = JSON.parse(rawBody); } catch {}
    console.log('[vapi] INCOMING REQUEST', JSON.stringify({
      headers: allHeaders,
      bodyPreview: rawBody.slice(0, 2000),
      messageType: parsedForDebug?.message?.type,
      phoneNumberPath: {
        'message.phoneNumber.id': parsedForDebug?.message?.phoneNumber?.id,
        'message.call.phoneNumberId': parsedForDebug?.message?.call?.phoneNumberId,
        'message.call.id': parsedForDebug?.message?.call?.id,
        'message.call': parsedForDebug?.message?.call ? Object.keys(parsedForDebug.message.call) : null,
        'message.phoneNumber': parsedForDebug?.message?.phoneNumber ? Object.keys(parsedForDebug.message.phoneNumber) : null,
      },
    }));
    // ─────────────────────────────────────────────────────────────────────────

    const secret = req.headers.get('x-vapi-secret');

    if (!verifyVapiSecret(secret)) {
      // Warn-only for now to diagnose — remove this and restore 401 once confirmed working
      console.warn('[vapi] secret mismatch — expected:', process.env.VAPI_WEBHOOK_SECRET ? 'SET' : 'NOT SET', 'received:', secret ? 'present' : 'missing');
    }

    const body = JSON.parse(rawBody);
    const messageType = body?.message?.type;
    const t0 = Date.now();

    switch (messageType) {
      case 'assistant-request': {
        const phoneNumberId =
          body?.message?.phoneNumber?.id ?? body?.message?.call?.phoneNumberId;

        console.log(`[vapi] assistant-request phoneNumberId=${phoneNumberId}`);

        if (!phoneNumberId) {
          console.error('[vapi] No phoneNumberId found. Full message keys:', Object.keys(body?.message ?? {}));
          return NextResponse.json({ error: 'No phone number ID in request' }, { status: 400 });
        }

        const business = await findAiBusinessByPhoneNumberId(phoneNumberId);

        if (!business) {
          console.error(`[vapi] No business found for phoneNumberId=${phoneNumberId}`);
          return NextResponse.json(
            { error: 'Business not found or AI receptionist disabled' },
            { status: 404 }
          );
        }

        if (business.aiReceptionistSpanishEnabled) {
          const workflow = buildKeypadLanguageSelectionWorkflow(business);
          console.log(
            `[vapi] assistant-request RETURNING WORKFLOW ms=${Date.now() - t0} bizId=${business.id} bizName=${business.name}`
          );
          return NextResponse.json({ workflow });
        }

        const assistant = buildAssistantConfig(business);
        console.log(
          `[vapi] assistant-request RETURNING ASSISTANT ms=${Date.now() - t0} bizId=${business.id} bizName=${business.name}`
        );
        return NextResponse.json({ assistant });
      }

      case 'tool-calls':
        return handleToolCalls(body);

      case 'conversation-update':
        await syncCallSessionFromConversationUpdate(body);
        return NextResponse.json({ received: true });

      case 'status-update':
        console.log(`[vapi] status-update status=${body?.message?.status} endedReason=${body?.message?.endedReason ?? '-'}`);
        if (body?.message?.status === 'ended') {
          await sendGroupedAiAppointmentConfirmationForEndedCall(body);
          await clearCallSession(body);
        }
        return NextResponse.json({ received: true });

      case 'end-of-call-report':
        console.log('[vapi] end-of-call-report', JSON.stringify({
          endedReason: body?.message?.endedReason,
          durationSeconds: body?.message?.durationSeconds,
          error: body?.message?.inboundPhoneCallDebuggingArtifacts?.error,
          assistantRequestError: body?.message?.inboundPhoneCallDebuggingArtifacts?.assistantRequestError,
        }));
        await sendGroupedAiAppointmentConfirmationForEndedCall(body);
        await clearCallSession(body);
        return NextResponse.json({ received: true });

      default:
        return NextResponse.json({ received: true });
    }
  } catch (error: any) {
    console.error('Vapi webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
