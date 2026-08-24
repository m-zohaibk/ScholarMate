import { NextResponse } from 'next/server';
import { createGeminiPdfUploadSession, GeminiFileUploadError } from '@/lib/gemini-files';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const input = await request.json() as { sizeBytes?: number; fileName?: string; mimeType?: string };
    if (input.mimeType !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF uploads are supported by the Gemini Files API path.' }, { status: 415 });
    }
    const result = await createGeminiPdfUploadSession(Number(input.sizeBytes), input.fileName || 'scholarmate-document.pdf');
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GeminiFileUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[API] Gemini PDF upload session failed:', error);
    return NextResponse.json({ error: 'The PDF upload session could not be created. Use the browser OCR fallback or try again.' }, { status: 502 });
  }
}
