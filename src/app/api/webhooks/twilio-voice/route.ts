import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';

// In-memory store for conversation history keyed by CallSid
// This persists for the duration of the Vercel function instance lifecycle
const conversationStore = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>();

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const publicId = searchParams.get('publicId');

  const body = await req.formData();
  const callSid = body.get('CallSid') as string;

  // Initialize conversation history for this call
  if (callSid && !conversationStore.has(callSid)) {
    conversationStore.set(callSid, []);
  }

  // Look up business
  const business = await prisma.business.findUnique({
    where: { publicId: publicId || undefined },
    select: {
      name: true,
      businessType: true,
      phone: true,
      street: true,
      city: true,
      state: true,
      timezone: true,
      publicId: true,
      aiReceptionistEnabled: true,
      aiReceptionistPhone: true,
      aiReceptionistGreeting: true,
    },
  });

  // If not found or not enabled, forward to real phone or hang up
  if (!business || !business.aiReceptionistEnabled) {
    const forwardPhone = business?.phone || business?.aiReceptionistPhone;
    if (forwardPhone) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Dial>${forwardPhone}</Dial></Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Thank you for calling. We are unable to take your call right now. Please try again later.</Say></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }

  const greeting = business.aiReceptionistGreeting ||
    `Hi, thank you for calling ${business.name}. How can I help you today?`;

  const appBase = getConfiguredAppBaseUrl();
  const processUrl = `${appBase}/api/webhooks/twilio-voice/process?publicId=${publicId}&callSid=${callSid}`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(greeting)}</Say>
  <Gather input="speech" action="${processUrl}" method="POST" timeout="5" speechTimeout="auto" language="en-US">
  </Gather>
  <Say voice="Polly.Joanna">I didn't hear anything. Please call back if you need assistance. Goodbye!</Say>
</Response>`;

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
