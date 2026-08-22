import { NextResponse } from 'next/server';
import { generateTeacherQuiz } from '@/ai/flows/teacher-quiz-generation';

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const result = await generateTeacherQuiz(input);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Teacher quiz generation failed:', error);
    const providerMessage = String((error as { originalMessage?: unknown })?.originalMessage || error);
    if (providerMessage.includes('401 Unauthorized')) return NextResponse.json({ error: 'Google AI authentication failed. Use a Google AI Studio API key in GOOGLE_GENAI_API_KEY, not an OAuth token.' }, { status: 503 });
    if (providerMessage.includes('429')) return NextResponse.json({ error: 'Google AI rate limit reached. Wait a moment and try again.' }, { status: 429 });
    return NextResponse.json({ error: 'Unable to generate quiz.' }, { status: 500 });
  }
}
