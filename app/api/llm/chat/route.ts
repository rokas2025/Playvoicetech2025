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
    const { messages, system_prompt, model, agent_knowledge } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Missing or invalid messages array' },
        { status: 400 }
      );
    }

    // Build system prompt with agent knowledge
    let finalSystemPrompt = system_prompt;
    
    if (agent_knowledge) {
      const { agent_name, agent_role, agent_task, agent_location, agent_info } = agent_knowledge;
      
      // Inject agent knowledge into system prompt
      const knowledgeContext = `
APIE TAVE:
- Vardas: ${agent_name || 'AI Asistentas'}
- Profesija/Rolė: ${agent_role || 'Virtualus asistentas'}
- Užduotis: ${agent_task || 'Padėti vartotojams'}
- Vieta: ${agent_location || 'Lietuva'}
${agent_info ? `- Papildoma informacija: ${agent_info}` : ''}

INSTRUKCIJOS:
${system_prompt || 'Tu esi naudingas AI asistentas, kuris visada atsako lietuvių kalba. Būk mandagus, aiškus ir informatyvus.'}

SVARBU:
- Visada atsakyk lietuvių kalba
- Naudok savo žinias apie save (vardą, rolę, užduotį) atsakydamas
- Būk mandagus, profesionalus ir naudingas
- Atsakyk trumpai ir konkrečiai, nebent prašoma plačiau paaiškinti
`.trim();
      
      finalSystemPrompt = knowledgeContext;
    } else if (!system_prompt) {
      // Default Lithuanian system prompt if no knowledge provided
      finalSystemPrompt = `Tu esi naudingas AI asistentas, kuris visada atsako lietuvių kalba. 
Būk mandagus, aiškus ir informatyvus. Atsakyk trumpai ir konkrečiai, nebent prašoma plačiau paaiškinti.`;
    }

    // Build messages array for OpenAI
    const openaiMessages = [
      {
        role: 'system' as const,
        content: finalSystemPrompt,
      },
      ...messages.map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    ];

    // Determine which model to use (default to GPT-4.1 mini - fastest and cheapest)
    const selectedModel = model || 'gpt-4.1-mini';
    
    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: selectedModel, // User can select: gpt-4.1-mini, gpt-4.1-nano, gpt-4o-mini, etc.
      messages: openaiMessages,
      temperature: 0.7,
      max_tokens: 500, // Good balance between quality and speed
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

