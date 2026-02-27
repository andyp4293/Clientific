import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// ── Vapi helpers ──────────────────────────────────────────────────────────────

function parseAreaCode(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '1') return digits.slice(1, 4);
  if (digits.length === 10) return digits.slice(0, 3);
  return '800';
}

async function vapiRequest(method: string, path: string, body?: object) {
  const res = await fetch(`https://api.vapi.ai${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.VAPI_PRIVATE_KEY}`,
      'Content-Type': 'application/json',
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '');
    throw new Error(`Vapi ${method} ${path} failed: ${res.status} ${text}`);
  }
  return res.status === 204 || res.status === 404 ? null : res.json();
}

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

function buildVapiAssistantBody(business: {
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

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        slug: true,
        publicId: true,
        email: true,
        businessType: true,
        phone: true,
        businessEmail: true,
        street: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        timezone: true,
        logoUrl: true,
        enableOnlineBooking: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        googleReviewUrl: true,
        facebookPageUrl: true,
        yelpUrl: true,
        instagramUrl: true,
        aiReceptionistEnabled: true,
        aiReceptionistPhone: true,
        aiReceptionistGreeting: true,
        vapiPhoneNumber: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    return NextResponse.json({ business });
  } catch (error: any) {
    console.error('Fetch business error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch business' },
      { status: 500 }
    );
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      businessType,
      phone,
      businessEmail,
      street,
      city,
      state,
      zipCode,
      country,
      timezone,
      logoUrl,
      enableOnlineBooking,
      googleReviewUrl,
      facebookPageUrl,
      yelpUrl,
      instagramUrl,
      aiReceptionistEnabled,
      aiReceptionistPhone,
      aiReceptionistGreeting,
    } = body;

    // Fetch current business to detect Vapi state changes and build system prompt
    const current = await prisma.business.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        businessType: true,
        phone: true,
        publicId: true,
        street: true,
        city: true,
        state: true,
        aiReceptionistEnabled: true,
        aiReceptionistPhone: true,
        aiReceptionistGreeting: true,
        vapiAssistantId: true,
        vapiPhoneNumberId: true,
        services: {
          where: { active: true },
          select: { name: true, price: true, duration: true },
          take: 20,
        },
        businessHours: { select: { hours: true } },
      },
    });

    if (!current) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Determine final enabled state
    const finalEnabled = aiReceptionistEnabled !== undefined
      ? aiReceptionistEnabled
      : current.aiReceptionistEnabled;

    // Build merged business data for Vapi (prefer incoming values for prompt)
    const businessForVapi = {
      name: name ?? current.name,
      businessType: businessType ?? current.businessType,
      phone: phone ?? current.phone,
      publicId: current.publicId,
      street: street !== undefined ? street : current.street,
      city: city !== undefined ? city : current.city,
      state: state !== undefined ? state : current.state,
      aiReceptionistGreeting: aiReceptionistGreeting !== undefined ? aiReceptionistGreeting : current.aiReceptionistGreeting,
      aiReceptionistPhone: aiReceptionistPhone !== undefined ? aiReceptionistPhone : current.aiReceptionistPhone,
      services: current.services,
      businessHours: current.businessHours,
    };

    // Vapi operations — only run if VAPI_API_KEY is configured
    const vapiUpdates: Record<string, string | null> = {};
    const vapiConfigured = !!process.env.VAPI_PRIVATE_KEY;

    if (vapiConfigured && finalEnabled && !current.vapiAssistantId) {
      // Toggling ON — create assistant + provision phone number
      const assistantBody = buildVapiAssistantBody(businessForVapi);
      const assistant = await vapiRequest('POST', '/assistant', assistantBody);
      const areaCode = parseAreaCode(current.phone);
      const phoneNumber = await vapiRequest('POST', '/phone-number', {
        provider: 'vapi',
        areaCode,
        assistantId: assistant.id,
        name: `${businessForVapi.name} Receptionist`,
      });
      vapiUpdates.vapiAssistantId = assistant.id;
      vapiUpdates.vapiPhoneNumberId = phoneNumber.id;
      vapiUpdates.vapiPhoneNumber = phoneNumber.number;
    } else if (vapiConfigured && !finalEnabled && current.vapiAssistantId) {
      // Toggling OFF — release phone number + delete assistant
      if (current.vapiPhoneNumberId) {
        await vapiRequest('DELETE', `/phone-number/${current.vapiPhoneNumberId}`);
      }
      await vapiRequest('DELETE', `/assistant/${current.vapiAssistantId}`);
      vapiUpdates.vapiAssistantId = null;
      vapiUpdates.vapiPhoneNumberId = null;
      vapiUpdates.vapiPhoneNumber = null;
    } else if (vapiConfigured && finalEnabled && current.vapiAssistantId) {
      // Already enabled — update assistant with fresh system prompt
      const assistantBody = buildVapiAssistantBody(businessForVapi);
      await vapiRequest('PATCH', `/assistant/${current.vapiAssistantId}`, assistantBody);
    }

    const business = await prisma.business.update({
      where: { id: session.user.id },
      data: {
        ...(name && { name }),
        ...(businessType && { businessType }),
        ...(phone && { phone }),
        ...(businessEmail !== undefined && { businessEmail }),
        ...(street !== undefined && { street }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(zipCode !== undefined && { zipCode }),
        ...(country !== undefined && { country }),
        ...(timezone && { timezone }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(enableOnlineBooking !== undefined && { enableOnlineBooking }),
        ...(googleReviewUrl !== undefined && { googleReviewUrl }),
        ...(facebookPageUrl !== undefined && { facebookPageUrl }),
        ...(yelpUrl !== undefined && { yelpUrl }),
        ...(instagramUrl !== undefined && { instagramUrl }),
        ...(aiReceptionistEnabled !== undefined && { aiReceptionistEnabled }),
        ...(aiReceptionistPhone !== undefined && { aiReceptionistPhone }),
        ...(aiReceptionistGreeting !== undefined && { aiReceptionistGreeting }),
        ...('vapiAssistantId' in vapiUpdates && { vapiAssistantId: vapiUpdates.vapiAssistantId }),
        ...('vapiPhoneNumberId' in vapiUpdates && { vapiPhoneNumberId: vapiUpdates.vapiPhoneNumberId }),
        ...('vapiPhoneNumber' in vapiUpdates && { vapiPhoneNumber: vapiUpdates.vapiPhoneNumber }),
      },
    });

    return NextResponse.json({ business });
  } catch (error: any) {
    console.error('Update business error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update business' },
      { status: 500 }
    );
  }
}
