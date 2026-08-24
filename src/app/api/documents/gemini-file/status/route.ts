import { NextResponse } from 'next/server';
import { GeminiFileUploadError, getGeminiPdfStatus } from '@/lib/gemini-files';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const input = await request.json() as { name?: string };
    const result = await getGeminiPdfStatus(input.name || '');
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GeminiFileUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[API] Gemini PDF status failed:', error);
    return NextResponse.json({ error: 'The Gemini PDF status could not be checked. Please try again.' }, { status: 502 });
  }
}
