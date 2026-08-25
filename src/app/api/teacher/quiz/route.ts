import { NextResponse } from 'next/server';
import { generateTeacherQuiz } from '@/ai/flows/teacher-quiz-generation';
import { getGoogleAiConfigurationError } from '@/lib/google-ai-config';

function isGeminiPdfUri(value: unknown): value is string {
  return typeof value === 'string' && /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/files\/[a-z0-9-]+$/i.test(value);
}

export async function POST(request: Request) {
  const configurationError = getGoogleAiConfigurationError();
  if (configurationError) return NextResponse.json({ error: configurationError }, { status: 503 });
  try {
    const input = await request.json();
    if (input.syllabusFileUri && !isGeminiPdfUri(input.syllabusFileUri)) {
      return NextResponse.json({ error: 'The attached PDF reference is invalid.' }, { status: 422 });
    }
    const result = await generateTeacherQuiz(input);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Teacher quiz generation failed:', error);
    const providerMessage = String((error as { originalMessage?: unknown })?.originalMessage || error);
    if (providerMessage.includes('401 Unauthorized')) return NextResponse.json({ error: 'Google AI authentication failed. Use a Google AI Studio API key in GOOGLE_GENAI_API_KEY, not an OAuth token.' }, { status: 503 });
    if (providerMessage.includes('429')) return NextResponse.json({ error: 'Google AI rate limit reached. Wait a moment and try again.' }, { status: 429 });
    if (/invalid json|json.*parse|parse.*json|schema validation/i.test(providerMessage.toLowerCase())) return NextResponse.json({ error: 'Gemini returned an invalid structured response. The syllabus was accepted; wait a moment and try again.' }, { status: 502 });
    return NextResponse.json({ error: 'Unable to generate quiz.' }, { status: 500 });
  }
}
