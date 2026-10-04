import { NextResponse } from 'next/server';
import { GeminiFileUploadError, uploadGeminiPdfFromBlob } from '@/lib/gemini-files';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const input = await request.json() as { pathname?: string; sizeBytes?: number; fileName?: string; mimeType?: string };
    if (input.mimeType !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF uploads are supported by the secure cloud upload path.' }, { status: 415 });
    }
    const sizeBytes = Number(input.sizeBytes);
    const fileName = input.fileName || 'scholarmate-document.pdf';
    console.log('[API] Gemini PDF ingestion started:', { pathname: input.pathname, sizeBytes, fileName, mimeType: input.mimeType });
    const result = await uploadGeminiPdfFromBlob(input.pathname || '', sizeBytes, fileName);
    console.log('[API] Gemini PDF ingestion active:', { fileName: result.fileName, state: result.state, hasUri: Boolean(result.fileUri), mimeType: result.mimeType });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GeminiFileUploadError) {
      console.error('[API] Gemini PDF ingestion failed:', { status: error.status, message: error.message });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[API] Gemini PDF ingestion failed:', { name: error instanceof Error ? error.name : 'UnknownError', message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'The PDF could not be uploaded to the secure cloud. Try again or use the on-device OCR fallback.' }, { status: 502 });
  }
}
