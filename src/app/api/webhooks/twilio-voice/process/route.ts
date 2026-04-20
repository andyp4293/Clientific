import { NextRequest, NextResponse } from 'next/server';
import { getTwilioVoiceForLanguage, resolveAiReceptionistCallLanguage } from '@/lib/ai-receptionist-language';
import {
  findAiReceptionistBusiness,
  initiateVapiBypassCall,
} from '../shared';

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const publicId = searchParams.get('publicId');
  const requestedLanguage = searchParams.get('lang');

  const body = await req.formData();
  const speechResult = (body.get('SpeechResult') as string) || '';
  const digits = (body.get('Digits') as string) || '';
  const callerNumber =
    ((body.get('Caller') as string) || (body.get('From') as string) || '').trim() || null;
  const toNumber =
    ((body.get('To') as string) || (body.get('Called') as string) || '').trim() || null;

  const business = await findAiReceptionistBusiness({ publicId, toNumber });

  if (!business || !business.aiReceptionistEnabled) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, I couldn't find the business information. Please try calling again.</Say></Response>`,
      { headers: { 'Content-Type': 'text/xml' } },
    );
  }

  const language =
    requestedLanguage === 'es' || requestedLanguage === 'en'
      ? requestedLanguage
      : resolveAiReceptionistCallLanguage({ digits, speechResult })?.language ?? 'en';

  const twiml = await initiateVapiBypassCall({
    business,
    callerNumber,
    forcedLanguage: language,
  });

  if (twiml) {
    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="${getTwilioVoiceForLanguage(
      language,
    )}">I'm sorry, we're having trouble connecting your call right now. Please try again in a moment.</Say></Response>`,
    { headers: { 'Content-Type': 'text/xml' } },
  );
}
