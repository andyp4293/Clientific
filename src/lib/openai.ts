interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface VoiceResponseParams {
  systemPrompt: string;
  conversationHistory: Message[];
  userMessage: string;
}

export async function generateVoiceResponse({
  systemPrompt,
  conversationHistory,
  userMessage,
}: VoiceResponseParams): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY not configured');
    return "I'm sorry, I'm having trouble right now. Please call back later or press 0 to speak with someone.";
  }

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 150,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('OpenAI error:', err);
    return "I'm having trouble right now. Let me connect you with someone who can help.";
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "I didn't catch that. Could you say that again?";
}
