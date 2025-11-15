import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { messages, system_prompt } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Missing or invalid messages array' },
        { status: 400 }
      );
    }

    // Default Lithuanian system prompt
    const defaultSystemPrompt = `Tu esi naudingas AI asistentas, kuris visada atsako lietuvių kalba. 
Būk mandagus, aiškus ir informatyvus. Atsakyk trumpai ir konkrečiai, nebent prašoma plačiau paaiškinti.`;

    // Build messages array for OpenAI
    const openaiMessages = [
      {
        role: 'system' as const,
        content: system_prompt || defaultSystemPrompt,
      },
      ...messages.map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    ];

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast and cost-effective
      messages: openaiMessages,
      temperature: 0.7,
      max_tokens: 150, // Shorter responses = faster (was 500)
      // Optional: Add prediction for even faster responses
      // prediction: { type: 'content', content: 'Taip,' }, // Uncomment to enable
    });

    const reply = completion.choices[0]?.message?.content || 'Atsiprašau, negalėjau sugeneruoti atsakymo.';

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('Error in LLM chat:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

