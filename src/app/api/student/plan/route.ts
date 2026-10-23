import { NextResponse } from 'next/server';
import { generateStudyPlan } from '@/ai/flows/study-plan-generation';
import { getGoogleAiConfigurationError } from '@/lib/google-ai-config';

export async function POST(request: Request) {
  const configurationError = getGoogleAiConfigurationError();
  if (configurationError) return NextResponse.json({ error: configurationError }, { status: 503 });
  try {
    const input = await request.json();
    if (!Array.isArray(input?.subjects) || !input.subjects.length) {
      return NextResponse.json({ error: 'Add at least one subject with an exam date.' }, { status: 422 });
    }
    const result = await generateStudyPlan({
      startDate: String(input.startDate || ''),
      hoursPerDay: Number(input.hoursPerDay) || 2,
      dayStartTime: String(input.dayStartTime || '15:00'),
      subjects: input.subjects,
      busyMinutesByDate: input.busyMinutesByDate || undefined,
      note: input.note || undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Study plan generation failed:', { name: error instanceof Error ? error.name : 'UnknownError', message: error instanceof Error ? error.message : String(error) });
    const providerMessage = String((error as { originalMessage?: unknown })?.originalMessage || error);
    if (providerMessage.includes('401 Unauthorized')) return NextResponse.json({ error: 'AI authentication failed. Check the server AI configuration.' }, { status: 503 });
    if (providerMessage.includes('429')) return NextResponse.json({ error: 'Rate limit reached. Wait a moment and try again.' }, { status: 429 });
    if (/invalid json|json.*parse|parse.*json|schema validation/i.test(providerMessage.toLowerCase())) return NextResponse.json({ error: 'The AI returned an invalid plan. Please try again.' }, { status: 502 });
    return NextResponse.json({ error: 'The study plan could not be generated. Please try again.' }, { status: 500 });
  }
}
