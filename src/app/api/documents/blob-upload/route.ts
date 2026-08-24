import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { MAX_GEMINI_APP_FILE_BYTES } from '@/lib/document-upload-limits';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.toLowerCase().endsWith('.pdf')) {
          throw new Error('Only PDF files are allowed.');
        }
        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: MAX_GEMINI_APP_FILE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ purpose: 'scholarmate-gemini-pdf' }),
        };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('[API] Vercel Blob PDF upload token failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'The PDF upload could not be started.' }, { status: 400 });
  }
}
