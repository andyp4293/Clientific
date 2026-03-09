import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { localToUTC } from '@/lib/timezone';

const ACTIVE_APPOINTMENT_STATUSES = ['pending', 'scheduled', 'confirmed'] as const;
const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;
const YES_WORDS = [
  'yes',
  'y',
  'yeah',
  'yep',
  'correct',
  'confirm',
  'book it',
  'go ahead',
  'sounds good',
];
const NO_WORDS = ['no', 'n', 'nope', 'not now', 'change', 'different', 'wrong'];

type BusinessForSmsAi = {
  id: string;
  name: string;
  timezone: string;
  street: string | null;
  city: string | null;
  state: string | null;
  smsAiGreeting: string | null;
  smsAiPhoneNumber: string | null;
  vapiPhoneNumber: string | null;
  services: { id: string; name: string; duration: number; price: number | null }[];
  staff: { id: string; fullName: string; workDays: number[] }[];
  businessHours: { hours: unknown } | null;
};

type SmsAiOptionSlot = { iso: string; label: string };
type SmsAiPendingOptions =
  | { type: 'slot_choices'; options: SmsAiOptionSlot[] }
  | { type: 'cancel_choices'; appointmentIds: string[] };

type SmsAiIntent =
  | 'book'
  | 'cancel'
  | 'hours'
  | 'services'
  | 'location'
  | 'confirm_yes'
  | 'confirm_no'
  | 'help'
  | 'unknown';

export type SmsAiResult = {
  handled: boolean;
  text: string;
  eventType: string;
  metadata?: Record<string, unknown>;
};

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

function toIsoDateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) return date.toISOString().slice(0, 10);
  return `${year}-${month}-${day}`;
}

function formatBusinessHours(hours: unknown): string {
  if (!hours) return 'Hours are not configured yet.';
  try {
    const parsed = typeof hours === 'string' ? JSON.parse(hours) : (hours as any);
    const rows = WEEKDAYS.map((day, i) => {
      const row = parsed?.[i.toString()] ?? (Array.isArray(parsed) ? parsed[i] : null);
      if (!row?.isOpen) return `${day[0].toUpperCase()}${day.slice(1)}: Closed`;
      return `${day[0].toUpperCase()}${day.slice(1)}: ${row.openTime} - ${row.closeTime}`;
    });
    return rows.join('\n');
  } catch {
    return 'Hours are not available right now.';
  }
}

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

function extractTime(text: string): string | null {
  const match = text.match(/\b(\d{1,2}(?::\d{2})?\s?(?:am|pm)?)\b/i);
  if (!match) return null;
  return match[1].trim();
}

function extractDate(text: string, timezone: string): string | null {
  const lower = text.toLowerCase();
  const now = new Date();

  if (lower.includes('today')) return toIsoDateInTimezone(now, timezone);
  if (lower.includes('tomorrow')) {
    return toIsoDateInTimezone(new Date(now.getTime() + 24 * 60 * 60 * 1000), timezone);
  }
  if (lower.includes('day after tomorrow')) {
    return toIsoDateInTimezone(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), timezone);
  }

  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  const us = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (us) {
    const month = us[1].padStart(2, '0');
    const day = us[2].padStart(2, '0');
    let year = us[3];
    if (!year) {
      year = toIsoDateInTimezone(now, timezone).slice(0, 4);
    } else if (year.length === 2) {
      year = `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  const weekdayMatch = lower.match(/\b(?:next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (weekdayMatch) {
    const todayIso = toIsoDateInTimezone(now, timezone);
    const today = new Date(`${todayIso}T00:00:00Z`);
    const currentDay = today.getUTCDay();
    const targetDay = WEEKDAYS.indexOf(weekdayMatch[1] as (typeof WEEKDAYS)[number]);
    if (targetDay >= 0) {
      let delta = (targetDay - currentDay + 7) % 7;
      if (delta === 0 || lower.includes('next ')) delta += 7;
      const target = new Date(today.getTime() + delta * 24 * 60 * 60 * 1000);
      return toIsoDateInTimezone(target, timezone);
    }
  }

  return null;
}

function extractName(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const named = trimmed.match(/\b(?:i am|i'm|this is|name is)\s+([a-z][a-z '-]{1,59})$/i);
  if (named) return named[1].trim().replace(/\s+/g, ' ');

  if (trimmed.length <= 60 && /^[a-z][a-z '-]+$/i.test(trimmed)) {
    return trimmed.replace(/\s+/g, ' ');
  }
  return null;
}

function detectIntent(text: string): SmsAiIntent {
  const lower = text.toLowerCase();
  if (lower.includes('help')) return 'help';
  if (YES_WORDS.some((w) => lower === w || lower.includes(` ${w}`) || lower.startsWith(`${w} `))) {
    return 'confirm_yes';
  }
  if (NO_WORDS.some((w) => lower === w || lower.includes(` ${w}`) || lower.startsWith(`${w} `))) {
    return 'confirm_no';
  }
  if (
    lower.includes('book') ||
    lower.includes('appointment') ||
    lower.includes('schedule') ||
    lower.includes('reserve')
  ) {
    return 'book';
  }
  if (lower.includes('cancel') || lower.includes('reschedule')) return 'cancel';
  if (lower.includes('hour') || lower.includes('open') || lower.includes('close')) return 'hours';
  if (lower.includes('service') || lower.includes('price') || lower.includes('cost')) return 'services';
  if (lower.includes('address') || lower.includes('location') || lower.includes('where')) return 'location';
  return 'unknown';
}

function normalizeWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function findServiceFromText(
  text: string,
  services: BusinessForSmsAi['services']
): BusinessForSmsAi['services'][number] | null {
  const lower = text.toLowerCase();
  const exact = services.find((service) => lower.includes(service.name.toLowerCase()));
  if (exact) return exact;

  const inputWords = new Set(normalizeWords(text));
  let best: { score: number; service: BusinessForSmsAi['services'][number] | null } = {
    score: 0,
    service: null,
  };

  for (const service of services) {
    const words = normalizeWords(service.name);
    if (!words.length) continue;
    let matches = 0;
    for (const word of words) {
      if (inputWords.has(word)) matches += 1;
    }
    const score = matches / words.length;
    if (score > best.score) best = { score, service };
  }

  return best.score >= 0.6 ? best.service : null;
}

function findStaffFromText(
  text: string,
  staffList: BusinessForSmsAi['staff']
): BusinessForSmsAi['staff'][number] | null {
  const lower = text.toLowerCase();
  return staffList.find((staff) => lower.includes(staff.fullName.toLowerCase())) || null;
}

function formatTimeForBusiness(date: Date, timezone: string): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
}

function formatDateTimeForBusiness(date: Date, timezone: string): string {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
}

async function findBusinessForInbound(toPhoneRaw: string | null): Promise<{
  business: BusinessForSmsAi | null;
  reason: 'ok' | 'no_business' | 'ambiguous';
}> {
  const toPhone = normalizePhone(toPhoneRaw);
  const businesses = await prisma.business.findMany({
    where: { smsAiEnabled: true },
    select: {
      id: true,
      name: true,
      timezone: true,
      street: true,
      city: true,
      state: true,
      smsAiGreeting: true,
      smsAiPhoneNumber: true,
      vapiPhoneNumber: true,
      services: {
        where: { active: true },
        select: { id: true, name: true, duration: true, price: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      },
      staff: {
        where: { active: true },
        select: { id: true, fullName: true, workDays: true },
        orderBy: { fullName: 'asc' },
      },
      businessHours: { select: { hours: true } },
    },
  });

  if (businesses.length === 0) return { business: null, reason: 'no_business' };

  if (toPhone) {
    const exactMatches = businesses.filter((business) => {
      const number = normalizePhone(business.smsAiPhoneNumber || business.vapiPhoneNumber);
      return number === toPhone;
    });
    if (exactMatches.length === 1) return { business: exactMatches[0], reason: 'ok' };
    if (exactMatches.length > 1) return { business: null, reason: 'ambiguous' };
  }

  if (businesses.length === 1) return { business: businesses[0], reason: 'ok' };
  return { business: null, reason: 'ambiguous' };
}

async function findMatchingCustomerIdsForBusiness(
  businessId: string,
  normalizedPhone: string
): Promise<string[]> {
  const customers = await prisma.customer.findMany({
    where: { businessId, phone: { not: null } },
    select: { id: true, phone: true },
  });
  return customers
    .filter((customer) => normalizePhone(customer.phone) === normalizedPhone)
    .map((customer) => customer.id);
}
async function getAvailability(
  business: BusinessForSmsAi,
  args: { date: string; serviceId: string; staffId?: string | null; requestedTime?: string | null }
): Promise<
  | { kind: 'closed' }
  | { kind: 'no_slots'; serviceName: string }
  | { kind: 'service_not_found' }
  | { kind: 'requested_available'; slot: SmsAiOptionSlot }
  | { kind: 'requested_taken'; requestedLabel: string; options: SmsAiOptionSlot[] }
  | { kind: 'slots'; options: SmsAiOptionSlot[]; serviceName: string }
  | { kind: 'invalid_time' }
> {
  const service = await prisma.service.findFirst({
    where: { id: args.serviceId, businessId: business.id, active: true },
    select: { duration: true, name: true },
  });
  if (!service) return { kind: 'service_not_found' };

  const hoursData = business.businessHours?.hours as any;
  const dayOfWeek = new Date(`${args.date}T00:00:00Z`).getUTCDay();
  const hours =
    hoursData?.[dayOfWeek.toString()] ?? (Array.isArray(hoursData) ? hoursData[dayOfWeek] : null);
  if (!hours?.isOpen) return { kind: 'closed' };

  if (args.staffId) {
    const staff = await prisma.staff.findFirst({
      where: { id: args.staffId, businessId: business.id, active: true },
      select: { workDays: true },
    });
    if (staff && !staff.workDays.includes(dayOfWeek)) return { kind: 'no_slots', serviceName: service.name };
  }

  const [openHour] = String(hours.openTime || '09:00').split(':').map(Number);
  const [closeHour, closeMinute] = String(hours.closeTime || '17:00').split(':').map(Number);
  const startOfDay = localToUTC(args.date, 0, 0, business.timezone);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

  const existingAppointments = args.staffId
    ? await prisma.appointment.findMany({
        where: {
          businessId: business.id,
          staffId: args.staffId,
          status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
          startTime: { gte: startOfDay, lte: endOfDay },
        },
        select: { startTime: true, endTime: true },
      })
    : [];

  const closeTime = localToUTC(args.date, closeHour, closeMinute, business.timezone);
  const now = new Date();
  const allOptions: SmsAiOptionSlot[] = [];

  for (let hour = openHour; hour <= closeHour; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      if (hour === closeHour && minute >= closeMinute) break;
      const slotTime = localToUTC(args.date, hour, minute, business.timezone);
      const slotEnd = new Date(slotTime.getTime() + service.duration * 60000);
      if (slotEnd > closeTime) continue;
      if (slotTime < now) continue;

      const conflict = args.staffId
        ? existingAppointments.some((appointment) => {
            const aptStart = new Date(appointment.startTime);
            const aptEnd = new Date(appointment.endTime);
            return (
              (slotTime >= aptStart && slotTime < aptEnd) ||
              (slotEnd > aptStart && slotEnd <= aptEnd) ||
              (slotTime <= aptStart && slotEnd >= aptEnd)
            );
          })
        : false;
      if (conflict) continue;

      allOptions.push({
        iso: slotTime.toISOString(),
        label: formatTimeForBusiness(slotTime, business.timezone),
      });
    }
  }

  if (allOptions.length === 0) return { kind: 'no_slots', serviceName: service.name };

  if (args.requestedTime) {
    const parsed = parseTimeString(args.requestedTime);
    if (!parsed) return { kind: 'invalid_time' };

    const requestedSlot = localToUTC(args.date, parsed.hour, parsed.minute, business.timezone);
    const requestedIso = requestedSlot.toISOString();
    const exact = allOptions.find((option) => option.iso === requestedIso);
    if (exact) return { kind: 'requested_available', slot: exact };

    const requestedLabel = formatTimeForBusiness(requestedSlot, business.timezone);
    const closest = [...allOptions]
      .sort(
        (a, b) =>
          Math.abs(new Date(a.iso).getTime() - requestedSlot.getTime()) -
          Math.abs(new Date(b.iso).getTime() - requestedSlot.getTime())
      )
      .slice(0, 3);

    return { kind: 'requested_taken', requestedLabel, options: closest };
  }

  return { kind: 'slots', options: allOptions.slice(0, 3), serviceName: service.name };
}

async function createBookingFromSession(
  business: BusinessForSmsAi,
  normalizedPhone: string,
  session: {
    serviceId: string | null;
    staffId: string | null;
    selectedSlotTime: Date | null;
    customerName: string | null;
    notes: string | null;
  }
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  if (!session.serviceId || !session.selectedSlotTime) {
    return { ok: false, message: 'I still need a service and time before I can book that.' };
  }

  const service = await prisma.service.findFirst({
    where: { id: session.serviceId, businessId: business.id, active: true },
    select: { id: true, name: true, duration: true },
  });
  if (!service) return { ok: false, message: 'That service was not found.' };

  const start = new Date(session.selectedSlotTime);
  const end = new Date(start.getTime() + service.duration * 60000);

  if (session.staffId) {
    const conflicts = await prisma.appointment.count({
      where: {
        businessId: business.id,
        staffId: session.staffId,
        status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
        OR: [
          { AND: [{ startTime: { lte: start } }, { endTime: { gt: start } }] },
          { AND: [{ startTime: { lt: end } }, { endTime: { gte: end } }] },
          { AND: [{ startTime: { gte: start } }, { endTime: { lte: end } }] },
        ],
      },
    });
    if (conflicts > 0) {
      return {
        ok: false,
        message: 'That time was just taken. Reply with another time and I can check what is open.',
      };
    }
  }

  const customerIds = await findMatchingCustomerIdsForBusiness(business.id, normalizedPhone);
  let customer =
    customerIds.length > 0
      ? await prisma.customer.findUnique({ where: { id: customerIds[0] } })
      : null;

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        businessId: business.id,
        phone: normalizedPhone,
        name: session.customerName || 'Customer',
        smsConsent: true,
        smsMarketingConsent: false,
      },
    });
  } else if (session.customerName && session.customerName !== customer.name) {
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: { name: session.customerName, smsConsent: true },
    });
  }

  const shortId = Math.random().toString(36).substring(2, 9).toUpperCase();
  await prisma.appointment.create({
    data: {
      businessId: business.id,
      customerId: customer.id,
      serviceId: service.id,
      serviceIds: [service.id],
      staffId: session.staffId || null,
      startTime: start,
      endTime: end,
      duration: service.duration,
      status: 'pending',
      source: 'sms_ai',
      shortId,
      notes: session.notes || null,
    },
  });

  await prisma.notification.create({
    data: {
      businessId: business.id,
      type: 'new_appointment',
      title: 'New Booking via SMS AI',
      message: `${customer.name} booked ${service.name} for ${formatDateTimeForBusiness(start, business.timezone)}`,
      link: '/dashboard/appointments',
    },
  });

  return {
    ok: true,
    message: `Booked: ${service.name} on ${formatDateTimeForBusiness(
      start,
      business.timezone
    )}. You are all set.`,
  };
}

async function listCancelableAppointments(
  business: BusinessForSmsAi,
  normalizedPhone: string
): Promise<{ ids: string[]; text: string }> {
  const customerIds = await findMatchingCustomerIdsForBusiness(business.id, normalizedPhone);
  if (customerIds.length === 0) return { ids: [], text: "I don't see any upcoming appointments for this number." };

  const appointments = await prisma.appointment.findMany({
    where: {
      businessId: business.id,
      customerId: { in: customerIds },
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      startTime: { gte: new Date() },
    },
    include: {
      service: { select: { name: true } },
      staff: { select: { fullName: true } },
    },
    orderBy: { startTime: 'asc' },
    take: 3,
  });

  if (!appointments.length) return { ids: [], text: "I don't see any upcoming appointments for this number." };

  const lines = appointments.map((appointment, index) => {
    const when = formatDateTimeForBusiness(new Date(appointment.startTime), business.timezone);
    const staffPart = appointment.staff?.fullName ? ` with ${appointment.staff.fullName}` : '';
    return `${index + 1}) ${appointment.service?.name ?? 'Appointment'}${staffPart} on ${when}`;
  });
  return {
    ids: appointments.map((appointment) => appointment.id),
    text: `Reply with the number to cancel:\n${lines.join('\n')}`,
  };
}

async function cancelAppointmentByChoice(
  business: BusinessForSmsAi,
  normalizedPhone: string,
  appointmentId: string
): Promise<{ ok: true; text: string } | { ok: false; text: string }> {
  const customerIds = await findMatchingCustomerIdsForBusiness(business.id, normalizedPhone);
  if (!customerIds.length) return { ok: false, text: "I couldn't find that appointment on your account." };

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      businessId: business.id,
      customerId: { in: customerIds },
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
    },
    include: { service: { select: { name: true } } },
  });
  if (!appointment) return { ok: false, text: "I couldn't find that appointment on your account." };

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: 'cancelled' },
  });

  await prisma.notification.create({
    data: {
      businessId: business.id,
      type: 'appointment_cancelled',
      title: 'Appointment Cancelled via SMS AI',
      message: `${appointment.service?.name ?? 'Appointment'} on ${formatDateTimeForBusiness(
        new Date(appointment.startTime),
        business.timezone
      )} was cancelled by customer`,
      link: '/dashboard/appointments',
    },
  });

  return {
    ok: true,
    text: `Cancelled: ${appointment.service?.name ?? 'appointment'} on ${formatDateTimeForBusiness(
      new Date(appointment.startTime),
      business.timezone
    )}.`,
  };
}

function serviceListText(business: BusinessForSmsAi): string {
  if (!business.services.length) return 'No services are listed yet.';
  const top = business.services.slice(0, 5).map((service) => {
    const price = service.price != null ? ` ($${service.price})` : '';
    return `${service.name}${price}`;
  });
  return `Services: ${top.join(', ')}.`;
}

async function resetSession(sessionId: string) {
  await prisma.smsAiSession.update({
    where: { id: sessionId },
    data: {
      state: 'idle',
      serviceId: null,
      staffId: null,
      requestedDate: null,
      requestedTime: null,
      selectedSlotTime: null,
      customerName: null,
      notes: null,
      pendingOptions: Prisma.JsonNull,
      lastIntent: null,
    },
  });
}

function parseNumberChoice(text: string): number | null {
  const match = text.trim().match(/^([1-9]\d*)$/);
  if (!match) return null;
  return Number(match[1]);
}
export async function handleSmsAiInbound(args: {
  fromPhoneRaw: string | null;
  toPhoneRaw: string | null;
  messageBody: string | null;
}): Promise<SmsAiResult | null> {
  const normalizedFrom = normalizePhone(args.fromPhoneRaw);
  const messageText = (args.messageBody || '').trim();
  if (!normalizedFrom || !messageText) return null;

  const { business, reason } = await findBusinessForInbound(args.toPhoneRaw);
  if (!business) {
    if (reason === 'ambiguous') {
      return {
        handled: true,
        text: 'Text the dedicated number listed by your business so I can route your request correctly.',
        eventType: 'AI_AMBIGUOUS_BUSINESS',
        metadata: { reason },
      };
    }
    return null;
  }

  const session = await prisma.smsAiSession.upsert({
    where: { businessId_phone: { businessId: business.id, phone: normalizedFrom } },
    create: {
      businessId: business.id,
      phone: normalizedFrom,
      turns: 1,
      lastInboundText: messageText,
    },
    update: {
      turns: { increment: 1 },
      lastInboundText: messageText,
    },
  });

  const textLower = messageText.toLowerCase();
  const intent = detectIntent(messageText);

  if (session.state === 'cancel_choose') {
    const pending = (session.pendingOptions as SmsAiPendingOptions | null) ?? null;
    const choice = parseNumberChoice(messageText);
    if (pending?.type === 'cancel_choices' && choice && pending.appointmentIds[choice - 1]) {
      const cancellation = await cancelAppointmentByChoice(
        business,
        normalizedFrom,
        pending.appointmentIds[choice - 1]
      );
      if (cancellation.ok) {
        await resetSession(session.id);
        return { handled: true, text: `${cancellation.text} Anything else?`, eventType: 'AI_CANCELLED' };
      }
      return { handled: true, text: cancellation.text, eventType: 'AI_CANCEL_FAILED' };
    }
  }

  if (session.state === 'booking_confirm') {
    if (intent === 'confirm_yes') {
      const booking = await createBookingFromSession(business, normalizedFrom, session);
      if (booking.ok) {
        await resetSession(session.id);
        return { handled: true, text: booking.message, eventType: 'AI_BOOKED' };
      }
      await prisma.smsAiSession.update({
        where: { id: session.id },
        data: { state: 'booking_collect_time' },
      });
      return { handled: true, text: booking.message, eventType: 'AI_BOOKING_FAILED' };
    }
    if (intent === 'confirm_no') {
      await prisma.smsAiSession.update({
        where: { id: session.id },
        data: {
          state: 'booking_collect_time',
          selectedSlotTime: null,
          pendingOptions: Prisma.JsonNull,
        },
      });
      return {
        handled: true,
        text: 'No problem. Reply with a different time and I will check availability.',
        eventType: 'AI_BOOKING_EDIT',
      };
    }
  }

  if (intent === 'help') {
    const greeting =
      business.smsAiGreeting ||
      `Hi from ${business.name}. I can help you book or cancel appointments by text.`;
    return {
      handled: true,
      text: `${greeting} Try: "Book manicure tomorrow at 3pm" or "Cancel my appointment."`,
      eventType: 'AI_HELP',
    };
  }

  if (intent === 'hours') {
    return {
      handled: true,
      text: `Business hours for ${business.name}:\n${formatBusinessHours(business.businessHours?.hours)}`,
      eventType: 'AI_HOURS',
    };
  }

  if (intent === 'services') {
    return { handled: true, text: serviceListText(business), eventType: 'AI_SERVICES' };
  }

  if (intent === 'location') {
    const location = [business.street, business.city, business.state].filter(Boolean).join(', ');
    return {
      handled: true,
      text: location ? `${business.name} is at ${location}.` : `${business.name} location is not listed yet.`,
      eventType: 'AI_LOCATION',
    };
  }

  if (intent === 'cancel') {
    const list = await listCancelableAppointments(business, normalizedFrom);
    if (!list.ids.length) {
      await resetSession(session.id);
      return { handled: true, text: list.text, eventType: 'AI_CANCEL_NONE' };
    }
    await prisma.smsAiSession.update({
      where: { id: session.id },
      data: {
        state: 'cancel_choose',
        pendingOptions: {
          type: 'cancel_choices',
          appointmentIds: list.ids,
        },
        lastIntent: 'cancel',
      },
    });
    return { handled: true, text: list.text, eventType: 'AI_CANCEL_LIST' };
  }

  const shouldBook =
    intent === 'book' ||
    session.state.startsWith('booking_') ||
    !!extractDate(messageText, business.timezone) ||
    !!extractTime(messageText);
  if (shouldBook) {
    const service =
      findServiceFromText(messageText, business.services) ||
      (session.serviceId
        ? business.services.find((candidate) => candidate.id === session.serviceId) || null
        : null);
    const staff =
      findStaffFromText(messageText, business.staff) ||
      (session.staffId ? business.staff.find((candidate) => candidate.id === session.staffId) || null : null);
    const requestedDate = extractDate(messageText, business.timezone) || session.requestedDate;
    const requestedTime = extractTime(messageText) || session.requestedTime;
    const providedName = extractName(messageText) || session.customerName;

    const pending = (session.pendingOptions as SmsAiPendingOptions | null) ?? null;
    const numericChoice = parseNumberChoice(messageText);
    if (pending?.type === 'slot_choices' && numericChoice && pending.options[numericChoice - 1]) {
      const selected = pending.options[numericChoice - 1];
      if (!providedName) {
        await prisma.smsAiSession.update({
          where: { id: session.id },
          data: {
            state: 'booking_collect_name',
            serviceId: service?.id || null,
            staffId: staff?.id || null,
            requestedDate,
            requestedTime: selected.label,
            selectedSlotTime: new Date(selected.iso),
            pendingOptions: Prisma.JsonNull,
          },
        });
        return {
          handled: true,
          text: `Great, ${selected.label} works. What name should I put on this booking?`,
          eventType: 'AI_BOOKING_NEEDS_NAME',
        };
      }
      await prisma.smsAiSession.update({
        where: { id: session.id },
        data: {
          state: 'booking_confirm',
          serviceId: service?.id || null,
          staffId: staff?.id || null,
          requestedDate,
          requestedTime: selected.label,
          selectedSlotTime: new Date(selected.iso),
          customerName: providedName,
          pendingOptions: Prisma.JsonNull,
        },
      });
      const serviceName = service?.name || 'your service';
      return {
        handled: true,
        text: `Please confirm: ${serviceName} on ${requestedDate} at ${selected.label} for ${providedName}. Reply YES to book.`,
        eventType: 'AI_BOOKING_CONFIRM_REQUEST',
      };
    }

    if (session.state === 'booking_collect_name' && providedName && session.selectedSlotTime) {
      const selectedLabel = formatTimeForBusiness(new Date(session.selectedSlotTime), business.timezone);
      const serviceName = service?.name || 'your service';
      await prisma.smsAiSession.update({
        where: { id: session.id },
        data: {
          state: 'booking_confirm',
          customerName: providedName,
          lastIntent: 'book',
        },
      });
      return {
        handled: true,
        text: `Please confirm: ${serviceName} on ${session.requestedDate} at ${selectedLabel} for ${providedName}. Reply YES to book.`,
        eventType: 'AI_BOOKING_CONFIRM_REQUEST',
      };
    }

    if (!service) {
      await prisma.smsAiSession.update({
        where: { id: session.id },
        data: {
          state: 'booking_collect_service',
          requestedDate,
          requestedTime,
          staffId: staff?.id || null,
          lastIntent: 'book',
        },
      });
      return {
        handled: true,
        text: `Which service do you want to book? ${serviceListText(business)}`,
        eventType: 'AI_BOOKING_NEEDS_SERVICE',
      };
    }

    if (!requestedDate) {
      await prisma.smsAiSession.update({
        where: { id: session.id },
        data: {
          state: 'booking_collect_time',
          serviceId: service.id,
          staffId: staff?.id || null,
          requestedTime,
          customerName: providedName,
          lastIntent: 'book',
        },
      });
      return {
        handled: true,
        text: `What date would you like for ${service.name}?`,
        eventType: 'AI_BOOKING_NEEDS_DATE',
      };
    }

    const availability = await getAvailability(business, {
      serviceId: service.id,
      staffId: staff?.id,
      date: requestedDate,
      requestedTime,
    });

    if (availability.kind === 'closed') {
      await prisma.smsAiSession.update({
        where: { id: session.id },
        data: {
          state: 'booking_collect_time',
          serviceId: service.id,
          staffId: staff?.id || null,
          requestedDate,
          requestedTime: null,
          lastIntent: 'book',
        },
      });
      return {
        handled: true,
        text: `We're closed on ${requestedDate}. Reply with another date.`,
        eventType: 'AI_BOOKING_CLOSED',
      };
    }

    if (availability.kind === 'service_not_found') {
      await resetSession(session.id);
      return {
        handled: true,
        text: 'I could not find that service. Please try again.',
        eventType: 'AI_BOOKING_SERVICE_NOT_FOUND',
      };
    }

    if (availability.kind === 'invalid_time') {
      return {
        handled: true,
        text: 'I could not understand that time. Try something like 3:30 PM.',
        eventType: 'AI_BOOKING_INVALID_TIME',
      };
    }

    if (availability.kind === 'no_slots') {
      await prisma.smsAiSession.update({
        where: { id: session.id },
        data: {
          state: 'booking_collect_time',
          serviceId: service.id,
          staffId: staff?.id || null,
          requestedDate,
          requestedTime: null,
          lastIntent: 'book',
        },
      });
      return {
        handled: true,
        text: `No open times for ${availability.serviceName} on ${requestedDate}. Reply with another date.`,
        eventType: 'AI_BOOKING_NO_SLOTS',
      };
    }

    if (availability.kind === 'requested_taken') {
      await prisma.smsAiSession.update({
        where: { id: session.id },
        data: {
          state: 'booking_collect_time',
          serviceId: service.id,
          staffId: staff?.id || null,
          requestedDate,
          requestedTime,
          customerName: providedName,
          pendingOptions: {
            type: 'slot_choices',
            options: availability.options,
          },
          lastIntent: 'book',
        },
      });
      return {
        handled: true,
        text: `${availability.requestedLabel} is unavailable. Reply 1, 2, or 3: ${availability.options
          .map((option, index) => `${index + 1}) ${option.label}`)
          .join('  ')}`,
        eventType: 'AI_BOOKING_ALTERNATIVES',
      };
    }

    const selectedSlot =
      availability.kind === 'requested_available' ? availability.slot : availability.options[0];
    if (!selectedSlot) {
      return {
        handled: true,
        text: 'I could not find an available time. Try another date.',
        eventType: 'AI_BOOKING_NO_SLOTS',
      };
    }

    if (!providedName) {
      await prisma.smsAiSession.update({
        where: { id: session.id },
        data: {
          state: 'booking_collect_name',
          serviceId: service.id,
          staffId: staff?.id || null,
          requestedDate,
          requestedTime: selectedSlot.label,
          selectedSlotTime: new Date(selectedSlot.iso),
          customerName: null,
          pendingOptions:
            availability.kind === 'slots'
              ? {
                  type: 'slot_choices',
                  options: availability.options,
                }
              : Prisma.JsonNull,
          lastIntent: 'book',
        },
      });
      if (availability.kind === 'slots') {
        return {
          handled: true,
          text: `I can do ${availability.options
            .map((option, index) => `${index + 1}) ${option.label}`)
            .join('  ')}. Reply with a number, then send the name for the booking.`,
          eventType: 'AI_BOOKING_OPTIONS',
        };
      }
      return {
        handled: true,
        text: `${selectedSlot.label} is open. What name should I put on the appointment?`,
        eventType: 'AI_BOOKING_NEEDS_NAME',
      };
    }

    await prisma.smsAiSession.update({
      where: { id: session.id },
      data: {
        state: 'booking_confirm',
        serviceId: service.id,
        staffId: staff?.id || null,
        requestedDate,
        requestedTime: selectedSlot.label,
        selectedSlotTime: new Date(selectedSlot.iso),
        customerName: providedName,
        pendingOptions:
          availability.kind === 'slots'
            ? {
                type: 'slot_choices',
                options: availability.options,
              }
            : Prisma.JsonNull,
        lastIntent: 'book',
      },
    });

    return {
      handled: true,
      text: `Please confirm: ${service.name} on ${requestedDate} at ${selectedSlot.label} for ${providedName}. Reply YES to book.`,
      eventType: 'AI_BOOKING_CONFIRM_REQUEST',
    };
  }

  if (textLower === 'hi' || textLower === 'hello' || textLower === 'hey') {
    return {
      handled: true,
      text:
        business.smsAiGreeting ||
        `Hi, this is ${business.name}. I can help with booking by text. Try "Book manicure tomorrow at 3pm".`,
      eventType: 'AI_GREETING',
    };
  }

  return {
    handled: true,
    text:
      'I can help you book or cancel appointments by text. Try "Book haircut tomorrow at 2pm" or "Cancel my appointment."',
    eventType: 'AI_FALLBACK',
  };
}
