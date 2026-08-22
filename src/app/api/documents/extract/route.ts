import { NextResponse } from 'next/server';
import { DocumentInputError, normalizeDocument } from '@/lib/document-extractor';

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const document = await normalizeDocument(input.dataUri, input.fileName, input.mimeType);
    return NextResponse.json({ fileName: document.fileName, format: document.format, text: document.extractedText, isScannedPdf: document.isScannedPdf });
  } catch (error) {
    if (error instanceof DocumentInputError) return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
    console.error('[API] Document extraction failed:', error);
    return NextResponse.json({ error: 'The document could not be read.' }, { status: 500 });
  }
}
