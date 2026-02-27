import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Signature verification ───────────────────────────────────────────────────

function verifyVapiSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (!secret) return true; // not configured → skip verification
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
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
      return `${day}: ${h.openTime} - ${h.closeTime}`;
    }).join('\n');
  } catch {
    return 'Hours not available.';
  }
}

// ─── Timezone-aware slot conversion ──────────────────────────────────────────

function businessTimeToUTC(dateStr: string, hour: number, minute: number, timezone: string): Date {
  const localStr = `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  const naiveUTC = new Date(localStr + 'Z');
  const inBizTz = new Date(naiveUTC.toLocaleString('en-US', { timeZone: timezone }));
  const offsetMs = naiveUTC.getTime() - inBizTz.getTime();
  return new Date(naiveUTC.getTime() + offsetMs);
}

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
  businessHours: { hours: any } | null;
};

// ─── Assistant config builder ─────────────────────────────────────────────────

function buildAssistantConfig(business: BusinessData) {
  const servicesList = business.services.length > 0
    ? business.services.map(s => {
        const price = s.price ? `$${s.price}` : 'price varies';
        return `- ${s.name} (ID: ${s.id}, ${s.duration} min, ${price})`;
      }).join('\n')
    : 'Services not listed. Please ask for more details.';

  const hoursText = formatBusinessHours(business.businessHours?.hours);
  const location = [business.street, business.city, business.state].filter(Boolean).join(', ') || 'Location not listed.';
  const bookingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/book/${business.publicId}`;

  const systemPrompt = `You are the AI receptionist for ${business.name}, a ${business.businessType}.

Business hours:
${hoursText}

Services offered (use the ID field when calling tools, never say the ID aloud):
${servicesList}

Location: ${location}
Online booking: ${bookingUrl}

Your job:
- Answer questions about services, prices, hours, and location concisely
- If the caller wants to book: ask which service and what date, call manage_booking with action "checkAvailability", present the times naturally (e.g. "I have 9 AM, 10:30 AM, and 2 PM open"), then ask which they prefer
- Once they pick a slot, confirm their name, then call manage_booking with action "createBooking"
- If they say "talk to a person", "real person", "human", "manager", or similar, say exactly: "Sure, let me connect you with someone now."
- Keep ALL responses under 2 sentences — this is a phone call, be brief
- Be warm and professional
- If you don't know the answer, say "Let me connect you with our team for that."
- Never read service IDs aloud; they are internal references only`;

  return {
    name: `${business.name} Receptionist`,
    firstMessage: business.aiReceptionistGreeting ||
      `Hi, thank you for calling ${business.name}. How can I help you today?`,
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [{ role: 'system', content: systemPrompt }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'manage_booking',
            description: 'Check available appointment slots or create a booking for the caller.',
            parameters: {
              type: 'object',
              properties: {
                action: {
                  type: 'string',
                  enum: ['checkAvailability', 'createBooking'],
                  description: 'checkAvailability: list open time slots. createBooking: create the appointment.',
                },
                date: {
                  type: 'string',
                  description: 'Date in YYYY-MM-DD format',
                },
                serviceId: {
                  type: 'string',
                  description: 'Service ID from the services list (not the name)',
                },
                slotTime: {
                  type: 'string',
                  description: 'ISO 8601 UTC datetime of the chosen slot — required for createBooking',
                },
                customerName: {
                  type: 'string',
                  description: "Caller's full name — required for createBooking",
                },
              },
              required: ['action', 'serviceId'],
            },
          },
        },
      ],
    },
    transcriber: {
      provider: 'deepgram',
      model: 'nova-2',
      language: 'en',
    },
    voice: { provider: 'azure', voiceId: 'en-US-JennyNeural' },
    voicemailDetection: {
      provider: 'vapi',
      enabled: true,
    },
    voicemailMessage: `Hi, you've reached ${business.name}. We missed your call — please call us back during business hours or book online at ${bookingUrl}.`,
    ...(business.aiReceptionistPhone && { forwardingPhoneNumber: business.aiReceptionistPhone }),
  };
}

// ─── Tool: checkAvailability ──────────────────────────────────────────────────

async function handleCheckAvailability(business: BusinessData, args: any): Promise<string> {
  const { date, serviceId } = args;
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

  const [openHour, openMinute] = hours.openTime.split(':').map(Number);
  const [closeHour, closeMinute] = hours.closeTime.split(':').map(Number);

  const startOfDay = businessTimeToUTC(date, 0, 0, business.timezone);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      businessId: business.id,
      status: { in: ['pending', 'scheduled', 'confirmed'] },
      startTime: { gte: startOfDay, lte: endOfDay },
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

      const hasConflict = existingAppointments.some(apt => {
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

  const formatted = slots.slice(0, 6).map(iso =>
    new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: business.timezone,
    })
  );
  const more = slots.length > 6 ? ` and ${slots.length - 6} more` : '';
  // Return available slots with their ISO times so the AI can pass them to createBooking
  const slotsWithIso = slots.slice(0, 6).map((iso, i) => `${formatted[i]} (${iso})`);
  return `Available for ${service.name} on ${date}: ${slotsWithIso.join(', ')}${more}. Which time works for you?`;
}

// ─── Tool: createBooking ──────────────────────────────────────────────────────

async function handleCreateBooking(business: BusinessData, args: any, callerPhone: string): Promise<string> {
  const { serviceId, slotTime, customerName } = args;
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

  // Conflict check
  const conflicts = await prisma.appointment.count({
    where: {
      businessId: business.id,
      status: { in: ['pending', 'scheduled', 'confirmed'] },
      OR: [
        { AND: [{ startTime: { lte: start } }, { endTime: { gt: start } }] },
        { AND: [{ startTime: { lt: end } }, { endTime: { gte: end } }] },
        { AND: [{ startTime: { gte: start } }, { endTime: { lte: end } }] },
      ],
    },
  });
  if (conflicts > 0) return 'That slot was just taken. Let me check availability again — what date works for you?';

  // Find or create customer
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

  // Serializable transaction: re-check conflicts and create atomically
  try {
    await prisma.$transaction(async (tx) => {
      const conflicts = await tx.appointment.count({
        where: {
          businessId: business.id,
          status: { in: ['pending', 'scheduled', 'confirmed'] },
          OR: [
            { AND: [{ startTime: { lte: start } }, { endTime: { gt: start } }] },
            { AND: [{ startTime: { lt: end } }, { endTime: { gte: end } }] },
            { AND: [{ startTime: { gte: start } }, { endTime: { lte: end } }] },
          ],
        },
      });
      if (conflicts > 0) throw new Error('SLOT_TAKEN');

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
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (err: any) {
    if (err.message === 'SLOT_TAKEN') {
      return 'That slot was just taken. Let me check availability again — what date works for you?';
    }
    throw err;
  }

  const formattedTime = start.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: business.timezone,
  });

  return `Done! I've submitted a booking request for ${customerName} — ${service.name} on ${formattedTime}. ${business.name} will confirm shortly. Is there anything else I can help with?`;
}

// ─── Tool calls dispatcher ────────────────────────────────────────────────────

async function handleToolCalls(body: any): Promise<NextResponse> {
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
      try {
        if (!business) {
          result = 'Unable to access business information right now.';
        } else if (fnName === 'manage_booking') {
          const { action } = parsedArgs;
          if (action === 'checkAvailability') {
            result = await handleCheckAvailability(business, parsedArgs);
          } else if (action === 'createBooking') {
            result = await handleCreateBooking(business, parsedArgs, callerPhone);
          } else {
            result = 'Unknown action requested.';
          }
        } else {
          result = 'Unknown tool.';
        }
      } catch (err: any) {
        console.error('Tool call error:', err);
        result = 'An error occurred processing your request.';
      }

      return { toolCallId, result };
    })
  );

  return NextResponse.json({ results });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-vapi-signature');

    if (!verifyVapiSignature(rawBody, signature)) {
      console.warn('Vapi webhook: invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const messageType = body?.message?.type;

    switch (messageType) {
      case 'assistant-request': {
        const phoneNumberId =
          body?.message?.phoneNumber?.id ?? body?.message?.call?.phoneNumberId;

        if (!phoneNumberId) {
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
            businessHours: { select: { hours: true } },
          },
        });

        if (!business) {
          return NextResponse.json(
            { error: 'Business not found or AI receptionist disabled' },
            { status: 404 }
          );
        }

        const assistant = buildAssistantConfig(business);
        return NextResponse.json({ assistant });
      }

      case 'tool-calls':
        return handleToolCalls(body);

      case 'status-update':
      case 'end-of-call-report':
      default:
        return NextResponse.json({ received: true });
    }
  } catch (error: any) {
    console.error('Vapi webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
