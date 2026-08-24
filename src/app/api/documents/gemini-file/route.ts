import { NextResponse } from 'next/server';
import { GeminiFileUploadError, uploadGeminiPdfFromBlob } from '@/lib/gemini-files';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const input = await request.json() as { pathname?: string; sizeBytes?: number; fileName?: string; mimeType?: string };
    if (input.mimeType !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF uploads are supported by the Gemini Files API path.' }, { status: 415 });
    }
    const result = await uploadGeminiPdfFromBlob(input.pathname || '', Number(input.sizeBytes), input.fileName || 'scholarmate-document.pdf');
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GeminiFileUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[API] Gemini PDF ingestion failed:', error);
    return NextResponse.json({ error: 'The PDF could not be transferred to Gemini. Use the browser OCR fallback or try again.' }, { status: 502 });
  }
}
