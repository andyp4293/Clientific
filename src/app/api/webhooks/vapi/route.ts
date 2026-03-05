import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendAppointmentConfirmation } from '@/lib/twilio';
import { localToUTC } from '@/lib/timezone';

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
  publicId: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  timezone: string;
  aiReceptionistGreeting: string | null;
  aiReceptionistPhone: string | null;
  services: { id: string; name: string; price: number | null; duration: number }[];
  staff: { id: string; fullName: string; role: string }[];
  businessHours: { hours: any } | null;
};

// ─── Assistant config builder ─────────────────────────────────────────────────

function buildAssistantConfig(business: BusinessData) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '');

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
  const location = [business.street, business.city, business.state].filter(Boolean).join(', ') || 'Location not listed.';
  const bookingUrl = `${appUrl}/book/${business.publicId}`;

  const staffList = business.staff.length > 0
    ? business.staff.map(s => `- ${s.fullName} (ID: ${s.id}${s.role !== 'staff' ? `, ${s.role}` : ''})`).join('\n')
    : null;

  const systemPrompt = `You are the AI receptionist for ${business.name}, a ${business.businessType}.

Today is ${todayStr} (${todayISO}). Always use this date when the caller says "today", "tomorrow", etc.

Business hours:
${hoursText}

Services offered (use the ID field when calling tools, never say the ID aloud):
${servicesList}
${staffList ? `\nOur team (use the ID field when calling tools, never say the ID aloud):\n${staffList}\n` : ''}
Location: ${location}
Online booking: ${bookingUrl}

Your job:
- If asked about hours, location, services, prices, or staff: answer directly from the information above — do NOT call any tools for these questions
- If the caller wants to BOOK a new appointment (phrases like "I want to book", "I'd like to schedule", "make an appointment", "I want an appointment", "can I get an appointment"):
  - Collect the following before calling checkAvailability — but if the caller already told you some or all of these upfront, skip asking and use what they gave you:
    1. Which service they want
    2. Whether they prefer a specific staff member (skip if they didn't mention one)
    3. Their preferred date and time
  - Once you have service + date (and optionally time and staff), call manage_booking with action "checkAvailability" — include date, serviceId, and optionally requestedTime and staffId
  - If the requested time is available, say the time back and ask "Can I get your name?"
    If the time is taken, present the 3 closest alternatives and ask which they prefer, then get their name
    If no specific time was given, present the options and ask which they'd like, then get their name
  - Once you have service, time, and name: read back a brief summary to confirm — e.g. "Got it — [service] on [day] at [time] for [name]. Shall I go ahead and book that?" — wait for the caller to confirm (yes/correct/go ahead/etc.) before calling createBooking. If they correct anything, update accordingly and confirm again before booking.
  - After they confirm: call manage_booking with action "createBooking" with serviceId, slotTime (exact ISO from checkAvailability result, the value in parentheses), customerName, and staffId if applicable. If the caller mentioned anything special at any point (e.g. "it's my birthday", "I'm allergic to lavender", "please have soft music"), include it as the notes field — do not ask for it. Do NOT call createBooking until you have confirmation from the caller.
  - The tool confirms the booking — relay the confirmation to the caller and always ask "Is there anything else I can help you with?"
  - Wait for their response before ending the call. If they say no (or "nope", "that's all", "I'm good", etc.), say the exact phrase: "Happy to help! Have a wonderful day — goodbye!" then call end_call
- If they want to VIEW or CANCEL an existing appointment (phrases like "check my appointment", "what's my appointment", "I need to cancel", "cancel my booking"): call manage_booking with action "getAppointments" to show their upcoming bookings, then ask which one to cancel, then call "cancelAppointment" with the appointmentId — never say the appointmentId aloud
- If they want to UPDATE an existing appointment (e.g. "change my name", "update my name to Jimmy", "add a note"): call manage_booking with action "getAppointments" first if you don't already have the appointmentId, then call "updateAppointment" with the appointmentId and the field(s) to change (customerName and/or notes) — never say the appointmentId aloud
- If they say "talk to a person", "real person", "human", "manager", or similar, say exactly: "Sure, let me connect you with someone now."
- When the caller signals they are done (says "goodbye", "bye", "that's all", "I'm good", "no", "nope", "nothing else", or similar), you MUST say the exact phrase: "Happy to help! Have a wonderful day — goodbye!" — then immediately call end_call. Do NOT just say "Goodbye!" alone.
- Never end the call without first saying that exact closing phrase.
- Before calling a tool, say one short natural phrase — vary it each time and match it to the situation. Examples: "Let me check that.", "Let me see what's open.", "Let me look at the schedule.", "Let me get that booked for you.", "Let me lock that in.", "Let me pull that up.", "One moment.", "Sure, let me grab that." — never repeat the same phrase twice in a row
- Keep ALL responses under 2 sentences — this is a phone call, be brief
- Be warm and professional
- If you don't know the answer, say "Let me connect you with our team for that."
- Never read service IDs or appointment IDs aloud; they are internal references only`;

  return {
    name: `${business.name} Receptionist`,
    firstMessage: business.aiReceptionistGreeting ||
      `Hi, thank you for calling ${business.name}. How can I help you today?`,
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
                  description: 'checkAvailability: list open slots. createBooking: book an appointment. getAppointments: show caller\'s upcoming appointments. cancelAppointment: cancel a specific appointment. updateAppointment: update details on an existing appointment (e.g. name, notes).',
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
                  description: 'Service ID from the services list — REQUIRED for checkAvailability and createBooking; omit for other actions',
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
                  description: "Caller's name — first name is fine — required for createBooking",
                },
                notes: {
                  type: 'string',
                  description: "Any special requests or notes from the caller — OPTIONAL for createBooking, e.g. 'birthday celebration', 'first time visitor', 'allergic to lavender'",
                },
                appointmentId: {
                  type: 'string',
                  description: 'Appointment ID — required for cancelAppointment',
                },
              },
              required: ['action'],
            },
          },
        },
        { type: 'endCall' },
      ],
    },
    server: {
      url: `${appUrl}/api/webhooks/vapi`,
    },
    transcriber: {
      provider: 'deepgram',
      model: 'nova-2',
      language: 'en',
    },
    voice: {
      provider: '11labs',
      voiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel — warm, professional American female
      stability: 0.45,
      similarityBoost: 0.75,
    },
    startSpeakingPlan: {
      waitSeconds: 0.4,
    },
    stopSpeakingPlan: {
      numWords: 0,
      voiceSeconds: 0.2,
      backoffSeconds: 1,
    },
    voicemailDetection: {
      provider: 'vapi',
    },
    voicemailMessage: `Hi, you've reached ${business.name}. We missed your call — please call us back during business hours or book online at ${bookingUrl}.`,
    silenceTimeoutSeconds: 60,
    ...(business.aiReceptionistPhone && { forwardingPhoneNumber: business.aiReceptionistPhone }),
  };
}

// ─── Tool: checkAvailability ──────────────────────────────────────────────────

async function handleCheckAvailability(business: BusinessData, args: any): Promise<string> {
  const { date, serviceId, staffId } = args;
  if (!date) return 'Please specify a date to check availability.';
  if (!serviceId) return 'Please specify a service.';

  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId: business.id, active: true },
    select: { duration: true, name: true },
  });
  if (!service) return 'That service was not found.';

  const hoursData = business.businessHours?.hours as any;
  const [year, month, day] = date.split('-').map(Number);
  const selectedDate = new Date(year, month - 1, day);
  const dayOfWeek = selectedDate.getDay();
  const hours = hoursData?.[dayOfWeek.toString()] ?? (Array.isArray(hoursData) ? hoursData[dayOfWeek] : null);

  if (!hours?.isOpen) return `We're closed on that day.`;

  // Check staff working days if a specific staff member was requested
  if (staffId) {
    const staffMember = await prisma.staff.findFirst({
      where: { id: staffId, businessId: business.id },
      select: { workDays: true, fullName: true },
    });
    if (staffMember && !staffMember.workDays.includes(dayOfWeek)) {
      return `${staffMember.fullName} doesn't work on that day. Would you like to pick a different day or a different staff member?`;
    }
  }

  const [openHour, openMinute] = hours.openTime.split(':').map(Number);
  const [closeHour, closeMinute] = hours.closeTime.split(':').map(Number);

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

  const closeTime = businessTimeToUTC(date, closeHour, closeMinute, business.timezone);
  const now = new Date();
  const slots: string[] = [];

  for (let hour = openHour; hour <= closeHour; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      if (hour === closeHour && minute >= closeMinute) break;
      const slotTime = businessTimeToUTC(date, hour, minute, business.timezone);
      const slotEndTime = new Date(slotTime.getTime() + service.duration * 60000);
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
  }

  if (slots.length === 0) return `No available slots on ${date} for ${service.name}.`;

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
      return `${label} is available for ${service.name}. Slot: ${label} (${requestedISO}). What is your name?`;
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
  return `Available for ${service.name} on ${date}: ${spokenTimes.join(', ')}${extra}. All slots: ${firstFour.join(', ')}. Which time works for you?`;
}

// ─── Tool: createBooking ──────────────────────────────────────────────────────

async function handleCreateBooking(business: BusinessData, args: any, callerPhone: string): Promise<string> {
  const { serviceId, slotTime, customerName, staffId, notes } = args;
  if (!slotTime) return 'I need the appointment time to book. Which slot works for you?';
  if (!serviceId) return 'I need the service to book.';
  if (!customerName) return 'What is your name?';

  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId: business.id, active: true },
    select: { duration: true, name: true },
  });
  if (!service) return 'That service was not found.';

  const start = new Date(slotTime);
  if (isNaN(start.getTime())) return 'Invalid time slot. Please check availability again.';
  const end = new Date(start.getTime() + service.duration * 60000);

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
  let customer = phone
    ? await prisma.customer.findFirst({ where: { businessId: business.id, phone } })
    : null;

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        businessId: business.id,
        name: customerName,
        phone: phone || undefined,
        smsConsent: false,
      },
    });
  } else {
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: { name: customerName },
    });
  }

  const shortId = Math.random().toString(36).substring(2, 9).toUpperCase();

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

        await tx.appointment.create({
          data: {
            businessId: business.id,
            customerId: customer!.id,
            serviceId,
            serviceIds: [serviceId],
            startTime: start,
            endTime: end,
            duration: service.duration,
            status: 'pending',
            shortId,
            source: 'ai',
            ...(staffId && { staffId }),
            ...(notes && { notes }),
          },
        });
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

  const staffLine = args.staffId
    ? await prisma.staff.findFirst({ where: { id: args.staffId, businessId: business.id }, select: { fullName: true } })
    : null;
  const withWhom = staffLine ? ` with ${staffLine.fullName}` : '';

  // Create in-app notification for business
  await prisma.notification.create({
    data: {
      businessId: business.id,
      type: 'new_appointment',
      title: 'New Booking via AI Receptionist',
      message: `${customerName} booked ${service.name}${withWhom} for ${formattedTime}`,
      link: `/dashboard/appointments`,
    },
  });

  // Send SMS confirmation non-blocking (same template as web booking)
  if (callerPhone) {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
    const apptUrl = `${appUrl}/a/${shortId}`;
    sendAppointmentConfirmation(callerPhone, {
      customerName,
      serviceName: service.name,
      staffName: staffLine?.fullName || 'our team',
      dateTime: start,
      businessName: business.name,
      timezone: business.timezone,
      appointmentUrl: apptUrl,
    }).catch((err) => console.error('[vapi] SMS send failed:', err));
  }

  return `Booking confirmed! ${customerName}, your ${service.name}${withWhom} is set for ${formattedTime}. ${business.name} will follow up shortly. Is there anything else I can help you with?`;
}

// ─── Tool: getAppointments ────────────────────────────────────────────────────

async function handleGetAppointments(business: BusinessData, callerPhone: string): Promise<string> {
  if (!callerPhone) return 'I need your phone number to look up your appointments.';

  const appointments = await prisma.appointment.findMany({
    where: {
      businessId: business.id,
      customer: { phone: callerPhone },
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
    const time = new Date(apt.startTime).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: business.timezone,
    });
    const staffPart = apt.staff ? ` with ${apt.staff.fullName}` : '';
    return `${i + 1}. ${apt.service?.name ?? 'Appointment'}${staffPart} on ${time} (ID: ${apt.id})`;
  }).join('\n');

  return `Here are your upcoming appointments:\n${list}\n\nWhich one would you like to cancel?`;
}

// ─── Tool: updateAppointment ──────────────────────────────────────────────────

async function handleUpdateAppointment(business: BusinessData, args: any, callerPhone: string): Promise<string> {
  const { appointmentId, customerName, notes } = args;
  if (!appointmentId) return 'Which appointment would you like to update?';
  if (!customerName && notes === undefined) return 'What would you like to change?';

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      businessId: business.id,
      customer: { phone: callerPhone },
      status: { in: ['pending', 'scheduled', 'confirmed'] },
    },
    include: { service: { select: { name: true } }, customer: { select: { id: true } } },
  });

  if (!appointment) return "I couldn't find that appointment on your account.";

  const updates: string[] = [];

  if (customerName) {
    await prisma.customer.update({
      where: { id: appointment.customer!.id },
      data: { name: customerName },
    });
    updates.push(`name updated to ${customerName}`);
  }

  if (notes !== undefined) {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { notes },
    });
    updates.push('notes updated');
  }

  return `Done — your appointment has been updated: ${updates.join(', ')}. Is there anything else I can help you with?`;
}

// ─── Tool: cancelAppointment ──────────────────────────────────────────────────

async function handleCancelAppointment(business: BusinessData, args: any, callerPhone: string): Promise<string> {
  const { appointmentId } = args;
  if (!appointmentId) return 'Which appointment would you like to cancel?';

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      businessId: business.id,
      customer: { phone: callerPhone },
      status: { in: ['pending', 'scheduled', 'confirmed'] },
    },
    include: { service: { select: { name: true } } },
  });

  if (!appointment) return 'I couldn\'t find that appointment on your account.';

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'cancelled' },
  });

  const time = new Date(appointment.startTime).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: business.timezone,
  });

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
  const callerPhone: string =
    body?.message?.call?.customer?.number ?? '';

  const business = phoneNumberId
    ? await prisma.business.findFirst({
        where: { vapiPhoneNumberId: phoneNumberId, aiReceptionistEnabled: true },
        select: {
          id: true,
          name: true,
          businessType: true,
          phone: true,
          publicId: true,
          street: true,
          city: true,
          state: true,
          timezone: true,
          aiReceptionistGreeting: true,
          aiReceptionistPhone: true,
          services: {
            where: { active: true },
            select: { id: true, name: true, price: true, duration: true },
            take: 20,
          },
          staff: {
            where: { active: true },
            select: { id: true, fullName: true, role: true },
            take: 20,
          },
          businessHours: { select: { hours: true } },
        },
      })
    : null;

  const results = await Promise.all(
    toolCallList.map(async (toolCall: any) => {
      const fnName: string = toolCall?.function?.name ?? '';
      const rawArgs = toolCall?.function?.arguments ?? {};
      const parsedArgs = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
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
            result = await handleCheckAvailability(business, parsedArgs);
          } else if (action === 'createBooking') {
            result = await handleCreateBooking(business, parsedArgs, callerPhone);
            outcome = result.startsWith('Done') ? 'booked' : 'conflict';
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

        const business = await prisma.business.findFirst({
          where: { vapiPhoneNumberId: phoneNumberId, aiReceptionistEnabled: true },
          select: {
            id: true,
            name: true,
            businessType: true,
            phone: true,
            publicId: true,
            street: true,
            city: true,
            state: true,
            timezone: true,
            aiReceptionistGreeting: true,
            aiReceptionistPhone: true,
            services: {
              where: { active: true },
              select: { id: true, name: true, price: true, duration: true },
              take: 20,
            },
            staff: {
              where: { active: true },
              select: { id: true, fullName: true, role: true },
              take: 20,
            },
            businessHours: { select: { hours: true } },
          },
        });

        if (!business) {
          console.error(`[vapi] No business found for phoneNumberId=${phoneNumberId}`);
          return NextResponse.json(
            { error: 'Business not found or AI receptionist disabled' },
            { status: 404 }
          );
        }

        const assistant = buildAssistantConfig(business);
        console.log(`[vapi] assistant-request RETURNING ASSISTANT ms=${Date.now() - t0} bizId=${business.id} bizName=${business.name}`);
        return NextResponse.json({ assistant });
      }

      case 'tool-calls':
        return handleToolCalls(body);

      case 'status-update':
        console.log(`[vapi] status-update status=${body?.message?.status} endedReason=${body?.message?.endedReason ?? '-'}`);
        return NextResponse.json({ received: true });

      case 'end-of-call-report':
        console.log('[vapi] end-of-call-report', JSON.stringify({
          endedReason: body?.message?.endedReason,
          durationSeconds: body?.message?.durationSeconds,
          error: body?.message?.inboundPhoneCallDebuggingArtifacts?.error,
          assistantRequestError: body?.message?.inboundPhoneCallDebuggingArtifacts?.assistantRequestError,
        }));
        return NextResponse.json({ received: true });

      default:
        return NextResponse.json({ received: true });
    }
  } catch (error: any) {
    console.error('Vapi webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
