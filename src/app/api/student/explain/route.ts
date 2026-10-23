import { NextResponse } from 'next/server';
import { explainSimply } from '@/ai/flows/explain-simply';
import { getGoogleAiConfigurationError } from '@/lib/google-ai-config';

export const maxDuration = 60;

export async function POST(request: Request) {
  const configurationError = getGoogleAiConfigurationError();
  if (configurationError) return NextResponse.json({ error: configurationError }, { status: 503 });
  try {
    const input = await request.json();
    if (!input?.question || !input?.explanation) {
      return NextResponse.json({ error: 'A question and its explanation are required.' }, { status: 422 });
    }
    const result = await explainSimply({
      question: String(input.question),
      correctAnswer: String(input.correctAnswer || ''),
      explanation: String(input.explanation),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Explain-simply failed:', { name: error instanceof Error ? error.name : 'UnknownError', message: error instanceof Error ? error.message : String(error) });
    const providerMessage = String((error as { originalMessage?: unknown })?.originalMessage || error);
    if (providerMessage.includes('429')) return NextResponse.json({ error: 'Rate limit reached. Wait a moment and try again.' }, { status: 429 });
    return NextResponse.json({ error: 'The explanation could not be simplified right now.' }, { status: 500 });
  }
}
