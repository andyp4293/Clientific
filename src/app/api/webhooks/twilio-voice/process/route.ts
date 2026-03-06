import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateVoiceResponse } from '@/lib/openai';

// Shared conversation store (same instance as parent route within same function container)
const conversationStore = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>();

const TRANSFER_KEYWORDS = [
  'talk to a person', 'talk to someone', 'real person', 'speak to someone',
  'speak to a person', 'human', 'agent', 'representative', 'manager',
  'transfer', 'connect me', 'front desk', 'someone else',
];

function wantsTransfer(text: string): boolean {
  const lower = text.toLowerCase();
  return TRANSFER_KEYWORDS.some((kw) => lower.includes(kw));
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

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const publicId = searchParams.get('publicId');
  const callSid = searchParams.get('callSid') || '';

  const body = await req.formData();
  const speechResult = (body.get('SpeechResult') as string) || '';

  // Fetch business with services and hours
  const business = await prisma.business.findUnique({
    where: { publicId: publicId || undefined },
    select: {
      name: true,
      businessType: true,
      phone: true,
      street: true,
      city: true,
      state: true,
      publicId: true,
      aiReceptionistEnabled: true,
      aiReceptionistPhone: true,
      aiReceptionistFaq: true,
      services: {
        where: { active: true },
        select: { name: true, price: true, duration: true, description: true },
        take: 20,
      },
      businessHours: { select: { hours: true } },
    },
  });

  if (!business) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, I couldn't find the business information. Please try calling again.</Say></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }

  // Check if caller wants to be transferred
  if (wantsTransfer(speechResult)) {
    const forwardPhone = business.aiReceptionistPhone || business.phone;
    if (forwardPhone) {
      conversationStore.delete(callSid);
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Sure, let me connect you with someone now. One moment please.</Say>
  <Dial>${forwardPhone}</Dial>
</Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }
  }

  // Build conversation history
  const history = conversationStore.get(callSid) || [];

  // Build services list
  const servicesList = business.services.length > 0
    ? business.services.map((s) => {
        const price = s.price ? `$${s.price}` : 'price varies';
        return `- ${s.name} (${s.duration} min, ${price})`;
      }).join('\n')
    : 'Services not listed. Please ask for more details.';

  // Build hours
  const hoursText = formatBusinessHours(business.businessHours?.hours);

  // Build location
  const location = [business.street, business.city, business.state].filter(Boolean).join(', ') || 'Location not listed.';

  // Build booking URL
  const bookingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/book/${business.publicId}`;

  // FAQ
  const faqItems = (business.aiReceptionistFaq as { question: string; answer: string }[] | null ?? []).filter(f => f.question && f.answer);
  const faqText = faqItems.length > 0
    ? '\n\nFrequently asked questions:\n' + faqItems.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')
    : '';

  // System prompt
  const systemPrompt = `You are the AI receptionist for ${business.name}, a ${business.businessType}.

Business hours:
${hoursText}

Services offered:
${servicesList}

Location: ${location}

Online booking: ${bookingUrl}${faqText}

Your job:
- Answer questions about services, prices, hours, and location concisely
- If the caller wants to book, say "I can text you our booking link right now"
- If they say "talk to a person", "real person", "human", "manager", or similar, say exactly: "Sure, let me connect you with someone now."
- Keep ALL responses under 2 sentences — this is a phone call, be brief
- Be warm and professional
- If you don't know the answer, say "Let me connect you with our team for that."`;

  // Generate AI response
  const aiText = await generateVoiceResponse({
    systemPrompt,
    conversationHistory: history,
    userMessage: speechResult || '(silence)',
  });

  // Update conversation history (keep last 4 turns to avoid URL length issues)
  history.push({ role: 'user', content: speechResult });
  history.push({ role: 'assistant', content: aiText });
  if (history.length > 8) history.splice(0, 2);
  conversationStore.set(callSid, history);

  // Check if AI response indicates a transfer
  if (wantsTransfer(aiText) || aiText.toLowerCase().includes('connect you with someone')) {
    const forwardPhone = business.aiReceptionistPhone || business.phone;
    if (forwardPhone) {
      conversationStore.delete(callSid);
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(aiText)}</Say>
  <Dial>${forwardPhone}</Dial>
</Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }
  }

  const processUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio-voice/process?publicId=${publicId}&callSid=${callSid}`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(aiText)}</Say>
  <Gather input="speech" action="${processUrl}" method="POST" timeout="5" speechTimeout="auto" language="en-US">
  </Gather>
  <Say voice="Polly.Joanna">Is there anything else I can help you with? Goodbye!</Say>
</Response>`;

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}
