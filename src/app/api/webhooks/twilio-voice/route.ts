import { NextRequest, NextResponse } from 'next/server';
import { getConfiguredWebhookBaseUrl } from '@/lib/app-url';
import {
  getAiReceptionistSelectionHints,
  getAiReceptionistVoiceGreeting,
  getTwilioGatherLanguage,
  getTwilioVoiceForLanguage,
} from '@/lib/ai-receptionist-language';
import {
  findAiReceptionistBusiness,
  initiateVapiBypassCall,
} from './shared';

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const publicId = searchParams.get('publicId');

  const body = await req.formData();
  const callSid = body.get('CallSid') as string;
  const callerNumber =
    ((body.get('Caller') as string) || (body.get('From') as string) || '').trim() || null;
  const toNumber =
    ((body.get('To') as string) || (body.get('Called') as string) || '').trim() || null;

  // Look up business
  const business = await findAiReceptionistBusiness({ publicId, toNumber });

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

  const greeting = getAiReceptionistVoiceGreeting(
    business.name,
    business.aiReceptionistGreeting,
    business.aiReceptionistSpanishEnabled,
  );

  const appBase = getConfiguredWebhookBaseUrl();
  const processQuery = new URLSearchParams();
  if (publicId) {
    processQuery.set('publicId', publicId);
  }
  if (callSid) {
    processQuery.set('callSid', callSid);
  }
  const processUrl = `${appBase}/api/webhooks/twilio-voice/process${
    processQuery.size ? `?${processQuery.toString()}` : ''
  }`;

  const englishVoice = getTwilioVoiceForLanguage('en');
  const englishLanguage = getTwilioGatherLanguage('en');

  if (!business.aiReceptionistSpanishEnabled) {
    const twiml = await initiateVapiBypassCall({
      business,
      callerNumber,
      forcedLanguage: 'en',
    });

    if (twiml) {
      return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="${englishVoice}">I'm sorry, we're having trouble connecting your call right now. Please try again in a moment.</Say></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${englishVoice}">${escapeXml(greeting)}</Say>
  <Gather input="speech dtmf" numDigits="1" hints="${escapeXml(getAiReceptionistSelectionHints())}" action="${escapeXml(processUrl)}" method="POST" timeout="5" speechTimeout="auto" language="${englishLanguage}">
  </Gather>
  <Say voice="${englishVoice}">I'll keep us in English.</Say>
  <Redirect method="POST">${escapeXml(`${processUrl}&lang=en`)}</Redirect>
  <Say voice="${englishVoice}">I didn't hear anything. Please call back if you need assistance. Goodbye!</Say>
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
