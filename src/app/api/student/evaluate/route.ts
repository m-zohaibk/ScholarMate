import { NextResponse } from 'next/server';
import { evaluateAnswer } from '@/ai/flows/evaluate-answer';
import { getGoogleAiConfigurationError } from '@/lib/google-ai-config';

export async function POST(request: Request) {
  const configurationError = getGoogleAiConfigurationError();
  if (configurationError) return NextResponse.json({ error: configurationError }, { status: 503 });
  try {
    const input = await request.json();
    const question = String(input?.question || '').trim();
    const referenceAnswer = String(input?.referenceAnswer || '').trim();
    const studentAnswer = String(input?.studentAnswer || '').trim();
    if (!question || !referenceAnswer || !studentAnswer) {
      return NextResponse.json({ error: 'Question, reference answer, and student answer are required.' }, { status: 422 });
    }
    const result = await evaluateAnswer({ question, referenceAnswer, studentAnswer });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Answer evaluation failed:', { name: error instanceof Error ? error.name : 'UnknownError', message: error instanceof Error ? error.message : String(error) });
    const providerMessage = String((error as { originalMessage?: unknown })?.originalMessage || error);
    if (providerMessage.includes('401 Unauthorized')) return NextResponse.json({ error: 'AI authentication failed. Check the server AI configuration.' }, { status: 503 });
    if (providerMessage.includes('429')) return NextResponse.json({ error: 'Rate limit reached. Wait a moment and try again.' }, { status: 429 });
    return NextResponse.json({ error: 'The answer could not be graded right now.' }, { status: 500 });
  }
}
