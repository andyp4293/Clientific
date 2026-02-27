import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function formatBusinessHours(hours: any): string {
  if (!hours) return 'Hours not specified.';
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  try {
    const parsed = typeof hours === 'string' ? JSON.parse(hours) : hours;
    return days.map((day, i) => {
      const h = Array.isArray(parsed) ? parsed[i] : parsed[i];
      if (!h || !h.isOpen) return `${day}: Closed`;
      return `${day}: ${h.openTime} - ${h.closeTime}`;
    }).join('\n');
  } catch {
    return 'Hours not available.';
  }
}

function buildAssistantConfig(business: {
  name: string;
  businessType: string;
  phone: string;
  publicId: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  aiReceptionistGreeting: string | null;
  aiReceptionistPhone: string | null;
  services: { name: string; price: number | null; duration: number }[];
  businessHours: { hours: any } | null;
}) {
  const servicesList = business.services.length > 0
    ? business.services.map((s) => {
        const price = s.price ? `$${s.price}` : 'price varies';
        return `- ${s.name} (${s.duration} min, ${price})`;
      }).join('\n')
    : 'Services not listed. Please ask for more details.';

  const hoursText = formatBusinessHours(business.businessHours?.hours);
  const location = [business.street, business.city, business.state].filter(Boolean).join(', ') || 'Location not listed.';
  const bookingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/book/${business.publicId}`;

  const systemPrompt = `You are the AI receptionist for ${business.name}, a ${business.businessType}.

Business hours:
${hoursText}

Services offered:
${servicesList}

Location: ${location}

Online booking: ${bookingUrl}

Your job:
- Answer questions about services, prices, hours, and location concisely
- If the caller wants to book, say "I can text you our booking link right now"
- If they say "talk to a person", "real person", "human", "manager", or similar, say exactly: "Sure, let me connect you with someone now."
- Keep ALL responses under 2 sentences — this is a phone call, be brief
- Be warm and professional
- If you don't know the answer, say "Let me connect you with our team for that."`;

  return {
    name: `${business.name} Receptionist`,
    firstMessage: business.aiReceptionistGreeting ||
      `Hi, thank you for calling ${business.name}. How can I help you today?`,
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemPrompt }],
    },
    voice: { provider: 'azure', voiceId: 'en-US-JennyNeural' },
    ...(business.aiReceptionistPhone && { forwardingPhoneNumber: business.aiReceptionistPhone }),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Vapi sends assistant-request when a call comes in
    const messageType = body?.message?.type;
    if (messageType !== 'assistant-request') {
      // Other event types (call ended, status updates, etc.) — acknowledge and ignore
      return NextResponse.json({ received: true });
    }

    // Identify which business owns this phone number
    const phoneNumberId = body?.message?.phoneNumber?.id ?? body?.message?.call?.phoneNumberId;

    if (!phoneNumberId) {
      return NextResponse.json({ error: 'No phone number ID in request' }, { status: 400 });
    }

    const business = await prisma.business.findFirst({
      where: { vapiPhoneNumberId: phoneNumberId, aiReceptionistEnabled: true },
      select: {
        name: true,
        businessType: true,
        phone: true,
        publicId: true,
        street: true,
        city: true,
        state: true,
        aiReceptionistGreeting: true,
        aiReceptionistPhone: true,
        services: {
          where: { active: true },
          select: { name: true, price: true, duration: true },
          take: 20,
        },
        businessHours: { select: { hours: true } },
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found or AI receptionist disabled' }, { status: 404 });
    }

    const assistant = buildAssistantConfig(business);
    return NextResponse.json({ assistant });
  } catch (error: any) {
    console.error('Vapi webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
