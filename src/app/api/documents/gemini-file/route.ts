import { NextResponse } from 'next/server';
import { GeminiFileUploadError, uploadPdfToGemini } from '@/lib/gemini-files';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF uploads are supported by the Gemini Files API path.' }, { status: 415 });
  }

  try {
    const displayName = decodeURIComponent(request.headers.get('x-file-name') || 'scholarmate-document.pdf');
    const result = await uploadPdfToGemini(request, displayName);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GeminiFileUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[API] Gemini PDF upload failed:', error);
    return NextResponse.json({ error: 'The PDF could not be uploaded to Gemini. Use the browser OCR fallback or try again.' }, { status: 502 });
  }
}
