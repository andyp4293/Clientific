import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateVoiceResponse } from '@/lib/openai';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';
import {
  type AiReceptionistCallLanguage,
  getConversationClosing,
  getLanguageSelectionAcknowledgement,
  getTransferConfirmation,
  getTwilioGatherLanguage,
  getTwilioVoiceForLanguage,
  resolveAiReceptionistCallLanguage,
} from '@/lib/ai-receptionist-language';

type ConversationMessage = { role: 'user' | 'assistant'; content: string };
type ConversationState = {
  history: ConversationMessage[];
  language: AiReceptionistCallLanguage;
};

const conversationStore = new Map<string, ConversationState>();

const TRANSFER_KEYWORDS = [
  'talk to a person',
  'talk to someone',
  'real person',
  'speak to someone',
  'speak to a person',
  'human',
  'agent',
  'representative',
  'manager',
  'transfer',
  'connect me',
  'front desk',
  'someone else',
  'hablar con alguien',
  'hablar con una persona',
  'persona real',
  'humano',
  'recepcion',
  'recepcionista',
  'conecteme',
  'transferir',
  'manager',
  'gerente',
  'equipo',
  'empleado',
  'alguien mas',
  'le conecto',
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
    return days
      .map((day, i) => {
        const h = Array.isArray(parsed) ? parsed[i] : parsed[i];
        if (!h || !h.isOpen) return `${day}: Closed`;
        return `${day}: ${h.openTime} - ${h.closeTime}`;
      })
      .join('\n');
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

function buildLanguageAwareSystemPrompt(params: {
  language: AiReceptionistCallLanguage;
  business: {
    name: string;
    businessType: string | null;
    street: string | null;
    city: string | null;
    state: string | null;
    publicId: string | null;
    aiReceptionistFaq: unknown;
    services: Array<{ name: string; price: number | null; duration: number; description: string | null }>;
    businessHours: { hours: unknown } | null;
  };
  bookingUrl: string;
}) {
  const { business, bookingUrl, language } = params;
  const servicesList =
    business.services.length > 0
      ? business.services
          .map((service) => {
            const price = service.price ? `$${service.price}` : 'price varies';
            return `- ${service.name} (${service.duration} min, ${price})`;
          })
          .join('\n')
      : 'Services not listed. Please ask for more details.';

  const hoursText = formatBusinessHours(business.businessHours?.hours);
  const location =
    [business.street, business.city, business.state].filter(Boolean).join(', ') ||
    'Location not listed.';
  const faqItems =
    ((business.aiReceptionistFaq as { question: string; answer: string }[] | null) ?? []).filter(
      (faq) => faq.question && faq.answer,
    );
  const faqText = faqItems.length
    ? '\n\nFrequently asked questions:\n' +
      faqItems.map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`).join('\n\n')
    : '';

  const englishLanguageSection = `
Language handling:
- The caller has already selected English, so respond entirely in English for the rest of the call.
- Keep all phrasing natural, warm, and brief for a live phone conversation.
- If the caller asks to switch to Spanish later, say you can do that and continue in Spanish.`;

  const spanishLanguageSection = `
Language handling:
- The caller has already selected Spanish, so respond entirely in Spanish for the rest of the call.
- Keep all phrasing natural, warm, and brief for a live phone conversation.
- If you need to mention a business name, service name, or URL, keep the exact proper noun but explain everything else in Spanish.
- If the caller asks to switch back to English later, you may do so.`;

  const transferLine =
    language === 'es'
      ? 'Si el cliente quiere hablar con una persona real, diga exactamente: "Claro, le conecto ahora."'
      : 'If the caller wants to speak with a real person, say exactly: "Sure, let me connect you with someone now."';

  const unknownAnswerLine =
    language === 'es'
      ? 'Si no sabe la respuesta, diga "No tengo esa informacion. Le puedo conectar con nuestro equipo."'
      : `If you don't know the answer, say "Let me connect you with our team for that."`;

  const bookingLine =
    language === 'es'
      ? 'Si el cliente quiere reservar, diga "Puedo enviarle por texto nuestro enlace para reservar ahora mismo."'
      : 'If the caller wants to book, say "I can text you our booking link right now".';

  return `You are the AI receptionist for ${business.name}, a ${business.businessType}.

Business hours:
${hoursText}

Services offered:
${servicesList}

Location: ${location}

Online booking: ${bookingUrl}${faqText}
${language === 'es' ? spanishLanguageSection : englishLanguageSection}

Your job:
- Answer questions about services, prices, hours, and location concisely
- ${bookingLine}
- ${transferLine}
- Keep ALL responses under 2 sentences — this is a phone call, be brief
- Be warm and professional
- ${unknownAnswerLine}`;
}

function buildGatherTwiml(params: {
  prompt: string;
  processUrl: string;
  language: AiReceptionistCallLanguage;
}) {
  const voice = getTwilioVoiceForLanguage(params.language);
  const gatherLanguage = getTwilioGatherLanguage(params.language);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">${escapeXml(params.prompt)}</Say>
  <Gather input="speech" action="${params.processUrl}&lang=${params.language}" method="POST" timeout="5" speechTimeout="auto" language="${gatherLanguage}">
  </Gather>
  <Say voice="${voice}">${escapeXml(getConversationClosing(params.language))}</Say>
</Response>`;
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const publicId = searchParams.get('publicId');
  const callSid = searchParams.get('callSid') || '';
  const requestedLanguage = searchParams.get('lang');

  const body = await req.formData();
  const speechResult = (body.get('SpeechResult') as string) || '';
  const digits = (body.get('Digits') as string) || '';

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
      aiReceptionistSpanishEnabled: true,
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
      { headers: { 'Content-Type': 'text/xml' } },
    );
  }

  const appBase = getConfiguredAppBaseUrl();
  const processUrl = `${appBase}/api/webhooks/twilio-voice/process?publicId=${publicId}&callSid=${callSid}`;
  const currentState = conversationStore.get(callSid) ?? {
    history: [],
    language: 'en' as AiReceptionistCallLanguage,
  };

  let language: AiReceptionistCallLanguage =
    requestedLanguage === 'es' || requestedLanguage === 'en'
      ? requestedLanguage
      : currentState.language;

  if (business.aiReceptionistSpanishEnabled && !requestedLanguage) {
    const selection = resolveAiReceptionistCallLanguage({
      digits,
      speechResult,
    });

    if (selection) {
      language = selection.language;

      if (selection.explicit && !selection.cleanedSpeech) {
        conversationStore.set(callSid, { ...currentState, language });
        return new NextResponse(
          buildGatherTwiml({
            prompt: getLanguageSelectionAcknowledgement(language),
            processUrl,
            language,
          }),
          { headers: { 'Content-Type': 'text/xml' } },
        );
      }

      if (selection.cleanedSpeech) {
        currentState.language = language;
        currentState.history = currentState.history;
      }
    } else {
      language = 'en';
      conversationStore.set(callSid, { ...currentState, language });
      return new NextResponse(
        buildGatherTwiml({
          prompt: getLanguageSelectionAcknowledgement(language),
          processUrl,
          language,
        }),
        { headers: { 'Content-Type': 'text/xml' } },
      );
    }
  }

  const normalizedSpeech =
    business.aiReceptionistSpanishEnabled && !requestedLanguage
      ? resolveAiReceptionistCallLanguage({ digits, speechResult })?.cleanedSpeech ?? speechResult
      : speechResult;

  if (wantsTransfer(normalizedSpeech)) {
    const forwardPhone = business.aiReceptionistPhone || business.phone;
    if (forwardPhone) {
      conversationStore.delete(callSid);
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${getTwilioVoiceForLanguage(language)}">${escapeXml(getTransferConfirmation(language))}</Say>
  <Dial>${forwardPhone}</Dial>
</Response>`,
        { headers: { 'Content-Type': 'text/xml' } },
      );
    }
  }

  const history = currentState.history;
  const bookingUrl = `${appBase}/book/${business.publicId}`;
  const systemPrompt = buildLanguageAwareSystemPrompt({
    language,
    business,
    bookingUrl,
  });
  const aiText = await generateVoiceResponse({
    systemPrompt,
    conversationHistory: history,
    userMessage: normalizedSpeech || '(silence)',
  });

  history.push({ role: 'user', content: normalizedSpeech });
  history.push({ role: 'assistant', content: aiText });
  if (history.length > 8) history.splice(0, 2);
  conversationStore.set(callSid, { history, language });

  if (wantsTransfer(aiText)) {
    const forwardPhone = business.aiReceptionistPhone || business.phone;
    if (forwardPhone) {
      conversationStore.delete(callSid);
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${getTwilioVoiceForLanguage(language)}">${escapeXml(aiText)}</Say>
  <Dial>${forwardPhone}</Dial>
</Response>`,
        { headers: { 'Content-Type': 'text/xml' } },
      );
    }
  }

  const twiml = buildGatherTwiml({
    prompt: aiText,
    processUrl,
    language,
  });

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}
